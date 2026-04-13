# Sprint 6 — Geofencing Auto-Complete

**Goal:** Automatically complete a permanent task instance when the user has spent
enough time at the location associated with that template.

**Platform:** Android + iOS native only. Not available on web.

---

## How It Works (User Perspective)

1. User creates a permanent task template with a location set (e.g. "Gym Session" → drop a pin on the gym)
2. User sets a **dwell threshold** on that template (e.g. 30 minutes)
3. User schedules an instance for today (template must already be scheduled — geofencing never creates instances)
4. User physically arrives at the gym → app silently records the entry timestamp
5. User leaves the gym → app records the exit timestamp and calculates dwell time
6. If dwell time ≥ threshold **and** today's instance is still pending → instance is auto-completed

If the user has no instance scheduled for today, nothing happens — identical contract to the Health Connect sprint-7 auto-complete (never creates, only completes).

---

## Key Technical Decisions

| Question | Decision |
|----------|----------|
| Trigger | ENTER + EXIT both required — duration is calculated from the pair |
| Auto-complete condition | Dwell time ≥ user threshold AND today's instance already exists |
| Map provider | `react-native-maps` + OSM `<UrlTile>` — no Google API key needed |
| Geocoding / search | Nominatim (free, OSM-powered) — see alternatives below |
| Background mode | `expo-location` + `expo-task-manager` |
| Battery strategy | Geofence-only — OS delivers ENTER/EXIT events, no continuous polling |
| Notification | Optional — can notify on exit if threshold was met, or silently complete |

---

## Map & Geocoding Stack

### Map tiles
`react-native-maps` with `<UrlTile urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />`.
No API key required. OSM tile usage policy requires attribution ("© OpenStreetMap contributors").

### Geocoding / place search — Nominatim
- **Nominatim** (`https://nominatim.openstreetmap.org`) — free, no key, OSM-powered.
  - Rate limit: **1 request/second** maximum. Must include a `User-Agent` header identifying the app.
  - Endpoints: `/search?q=...&format=json` (text → coords), `/reverse?lat=&lon=&format=json` (coords → address label).
  - No bulk or automated requests. Attribution required in the UI.

### Nominatim alternatives
| Service | Free tier | Key required |
|---------|-----------|--------------|
| Photon (Komoot) | Unlimited (OSM-based, self-hostable) | No |
| Geoapify | 3,000 req/day | Yes (free plan) |
| OpenCage | 2,500 req/day | Yes (free plan) |
| Mapbox Geocoding | 100,000 req/month | Yes (free plan) |
| Google Places API | No free tier — billing required from first request | Yes + billing |

Photon is the best fallback: same OSM data, no key, no rate limit, open source. Could self-host if usage grows.

---

## Google Play Services & Android Geofencing

- `expo-location`'s geofencing on Android is backed by the **Android Geofencing API**, which requires **Google Play Services** at runtime — even though the map tiles are OSM-based.
- This is a hard dependency: geofencing is not available on devices without Play Services (e.g. some Huawei models). Detect via `expo-device` / `expo-modules-core` and show a fallback message.
- Geofencing does **not** require the Google Maps SDK or a Maps API key — only Play Services runtime. OSM tiles are fine.

---

## expo-location & expo-task-manager Notes

### expo-location
- `Location.startGeofencingAsync(taskName, regions)` registers circular geofences.
  - Region shape: `{ identifier: templateId, latitude, longitude, radius, notifyOnEnter: true, notifyOnExit: true }`
  - Set both `notifyOnEnter` and `notifyOnExit` — both events are needed to compute dwell time.
- Platform limits:
  - **Android**: up to **100** simultaneous geofences per app
  - **iOS**: up to **20** simultaneous geofences per app — need an eviction strategy (drop least-recently-used geofences beyond 20)
- Geofences are **cleared on device reboot** — must call `startGeofencingAsync` again on every app start.

### expo-task-manager
- Background task is defined with `TaskManager.defineTask(TASK_NAME, handler)` — must be called at the module level (top of `index.ts`), before `startGeofencingAsync`.
- Handler receives `{ data: { eventType: GeofencingEventType.Enter | .Exit, region }, error }`.
- The handler runs in the background even when the app is closed.

### ACCESS_BACKGROUND_LOCATION (Android 10+)
- Required for geofence events to fire when the app is backgrounded or killed.
- Must be requested **after** foreground location is granted — Android enforces this two-step flow.
- Google Play Store requires a declared use-case and privacy policy for background location. Plan an in-app rationale screen (`GeofencePermissionScreen`) that explains why background location is needed before the OS dialog is shown.

---

## Battery Strategy

Continuous location polling is not used at any point. Only OS-delivered geofence ENTER/EXIT events fire. These are hardware-efficient — the Android Geofencing API uses cell towers, WiFi, and GPS fusion via Play Services and wakes the app only on boundary crossings.

The app stores exactly **two timestamps per visit**: `entered_at` (on ENTER) and `exited_at` (on EXIT). No track logs, no background loops. Duration is computed at exit time.

---

## Auto-Complete Logic

```
On ENTER event (background task):
  → INSERT geofence_log row: { id, templateId, entered_at: now, exited_at: NULL }

On EXIT event (background task):
  → UPDATE geofence_log SET exited_at = now WHERE templateId AND exited_at IS NULL
  → duration = exited_at − entered_at (milliseconds → minutes)
  → load template's geofence_threshold_minutes
  → if duration < threshold → stop, do nothing
  → query today's pending instance for templateId
      (same logic as HC sprint-7 findTodaysPendingInstance — tasks WHERE due_date
       BETWEEN today-midnight AND today-23:59, completed = 0)
  → if pending instance found → completeTask(instance)
  → if no pending instance (not scheduled, or already completed) → do nothing
  ── NEVER creates a new instance ──
```

---

## Biggest Design Issue: Location Is Currently a Text String

Templates store `location` as a plain string (e.g. `"Gym"`). Geofencing requires real coordinates.

**Current:** `location: string` on `PermanentTask`
**Needed:** `lat`, `lng`, `radius`, `geofenceEnabled`, `geofenceThresholdMinutes` columns

### Schema changes required

```sql
-- Extend templates with coordinates + geofence settings
ALTER TABLE templates ADD COLUMN location_lat              REAL;
ALTER TABLE templates ADD COLUMN location_lng              REAL;
ALTER TABLE templates ADD COLUMN location_radius           INTEGER DEFAULT 100; -- metres
ALTER TABLE templates ADD COLUMN geofence_enabled          INTEGER DEFAULT 0;
ALTER TABLE templates ADD COLUMN geofence_threshold_minutes INTEGER DEFAULT 30;

-- New table: one row per geofence visit (entry + exit pair)
CREATE TABLE IF NOT EXISTS geofence_log (
  id           TEXT    PRIMARY KEY,
  template_id  TEXT    NOT NULL,
  entered_at   INTEGER NOT NULL,   -- Unix ms
  exited_at    INTEGER,            -- Unix ms; NULL until EXIT event fires
  synced_at    INTEGER NOT NULL
);
```

Existing templates keep their text `location` name. Coordinates start as NULL — geofencing is disabled for them until the user re-sets the location with a pin via `LocationPickerScreen`.

---

## New Components

| Component | Purpose |
|-----------|---------|
| `LocationPickerScreen` | `react-native-maps` + OSM UrlTile; pin drop; radius slider; Nominatim search bar |
| `GeofenceService` | Registers/unregisters geofences via `expo-location`; defines the `expo-task-manager` background task; handles ENTER (write entered_at) and EXIT (write exited_at, evaluate threshold, complete task) |
| `GeofenceStorage` | Reads/writes `geofence_log`; reads template lat/lng/radius/threshold from `templates` |
| `GeofencePermissionScreen` | Explains background location use before requesting `ACCESS_BACKGROUND_LOCATION` |

---

## Libraries

| Library | Purpose |
|---------|---------|
| `expo-location` | Foreground location permission; `startGeofencingAsync` |
| `expo-task-manager` | Background task definition for geofence events |
| `react-native-maps` | Map view in `LocationPickerScreen` (OSM tiles via `UrlTile`) |
| `expo-notifications` | Optional notification on arrival / threshold met |

None of these are installed yet — all need to be added to `package.json`.

---

## Permissions Required

- `ACCESS_FINE_LOCATION` (Android) — foreground; declared in `app.json`
- `ACCESS_BACKGROUND_LOCATION` (Android 10+) — required for background geofence events; triggers Play Store review process
- `NSLocationAlwaysAndWhenInUseUsageDescription` (iOS) — background location; required in `app.json`
- `POST_NOTIFICATIONS` (Android 13+) — if arrival notification is added

---

## Data Flow

```
User opens CreatePermanentTaskScreen / EditPermanentTaskScreen
    → taps "Set Location"
    → LocationPickerScreen opens (react-native-maps + OSM tiles)
    → user types place name → Nominatim search returns suggestions
    → user selects suggestion OR drops pin manually
    → user adjusts radius slider
    → user sets dwell threshold (minutes)
    → coordinates + settings saved to templates table

App startup:
    GeofenceService.reregisterAll()
        → reads all templates WHERE geofence_enabled = 1 AND lat IS NOT NULL
        → calls startGeofencingAsync with those regions
        (necessary because geofences clear on reboot)

Background (app closed or backgrounded):
    expo-task-manager GEOFENCE_TASK
        ENTER → geofence_log INSERT (entered_at)
        EXIT  → geofence_log UPDATE (exited_at)
               → evaluate threshold
               → if met: findTodaysPendingInstance → completeTask
```

---

## Task List

- [ ] Install `expo-location`, `expo-task-manager`, `react-native-maps`
- [ ] Extend `PermanentTask` type — add `lat`, `lng`, `radius`, `geofenceEnabled`, `geofenceThresholdMinutes`
- [ ] DB migration — add coordinate + geofence columns to `templates` table
- [ ] DB migration — create `geofence_log` table
- [ ] Build `LocationPickerScreen` (react-native-maps + OSM UrlTile + Nominatim search bar)
- [ ] Wire location picker into `CreatePermanentTaskScreen` and `EditPermanentTaskScreen`
- [ ] Add dwell threshold input (minutes) to template edit screen
- [ ] Add geofence on/off toggle per template
- [ ] Build `GeofencePermissionScreen` (rationale before background location request)
- [ ] Build `GeofenceService` — register/unregister, ENTER handler, EXIT handler + threshold evaluation + task completion
- [ ] Build `GeofenceStorage` — geofence_log CRUD + template coordinate reads
- [ ] Re-register all geofences on app startup (`GeofenceService.reregisterAll()`)
- [ ] Handle Play Services unavailable gracefully (detect + show message)
- [ ] iOS eviction strategy for >20 geofences
- [ ] Research `expo-location` geofencing API limits and any Android-specific quirks
- [ ] Test on physical Android device (geofencing does not work in emulator)

---

## Known Limitations

- **iOS**: 20 geofence limit per app — need eviction strategy for users with many templates
- **Android background location**: Users may deny `ACCESS_BACKGROUND_LOCATION`; handle gracefully (disable geofencing for that template, show explanation)
- **Play Services required on Android**: Devices without Play Services cannot use geofencing
- **Reboot clears geofences**: Must re-register on every app open
- **Indoor accuracy**: Geofence accuracy depends on GPS/WiFi/cell signal — may be poor indoors or in dense urban environments
- **Dwell time edge case**: If the device reboots while the user is inside a geofence, `exited_at` from the previous session is never written. The incomplete log row should be detected and discarded (any row with `entered_at` from a previous calendar day and `exited_at IS NULL` is stale)
