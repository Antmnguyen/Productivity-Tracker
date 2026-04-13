# Sprint 6 — Geofencing Auto-Complete

**Goal:** Automatically complete a permanent task instance when the user has spent
enough time at a geofenced location linked to that template.

**Platform:** Android + iOS native only. Not available on web.

---

## Architecture Principle

Geofencing is a **one-way consumer** of the permanent task system — exactly the same
relationship as Health Connect (sprint-7).

- Permanent tasks, templates, and all their UI/storage/backend are **completely untouched**.
- The `templates` table, `PermanentTask` type, `taskActions.ts`, create/edit screens — none of these change.
- Permanent tasks have zero knowledge that geofencing exists.
- Geofencing knows about permanent tasks only to call `completeTask()` from `taskActions.ts`
  at the moment a threshold is met — the same call HC makes.
- All geofencing configuration, storage, and UI lives exclusively inside the geofencing
  feature area and the Browse page hub screen.

---

## How It Works (User Perspective)

1. User opens the **Geofencing screen** in Browse (same pattern as the Health Connect hub)
2. User taps "Add Location" → picks a permanent task template from a list
3. User drops a pin on the map, sets radius, sets a **dwell threshold** (e.g. 30 minutes)
4. User schedules a task instance for today as normal (no change to that flow)
5. User physically arrives at the location → app silently records the entry timestamp
6. User leaves → app records the exit timestamp and computes dwell time
7. If dwell time ≥ threshold **and** today's instance is still pending → auto-completed

If no instance is scheduled for today, nothing happens. Geofencing **never creates instances** — identical contract to the Health Connect auto-complete.

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
| Permanent task changes | **None** — zero touches to templates, PermanentTask type, or existing screens |

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

Photon is the best fallback: same OSM data, no key, no rate limit, open source.

---

## Google Play Services & Android Geofencing

- `expo-location`'s geofencing on Android is backed by the **Android Geofencing API**, which requires **Google Play Services** at runtime — even though the map tiles are OSM-based.
- Hard dependency: geofencing is not available on devices without Play Services (e.g. some Huawei models). Detect and show a fallback message.
- Geofencing does **not** require the Google Maps SDK or a Maps API key — only Play Services runtime. OSM tiles are fine.

---

## expo-location & expo-task-manager Notes

### expo-location
- `Location.startGeofencingAsync(taskName, regions)` registers circular geofences.
  - Region shape: `{ identifier: geofenceId, latitude, longitude, radius, notifyOnEnter: true, notifyOnExit: true }`
  - The `identifier` is the row `id` from `geofence_locations` (not the templateId directly — one template could theoretically have multiple locations in future, but for now 1:1).
  - Set both `notifyOnEnter` and `notifyOnExit` — both events are needed to compute dwell time.
- Platform limits:
  - **Android**: up to **100** simultaneous geofences per app
  - **iOS**: up to **20** simultaneous geofences per app — need an eviction strategy (drop least-recently-used beyond 20)
- Geofences are **cleared on device reboot** — must call `startGeofencingAsync` again on every app start.

### expo-task-manager
- Background task defined with `TaskManager.defineTask(TASK_NAME, handler)` — must be called at the module level (top of `index.ts`), before `startGeofencingAsync`.
- Handler receives `{ data: { eventType: GeofencingEventType.Enter | .Exit, region }, error }`.
- Runs in the background even when the app is closed.

### ACCESS_BACKGROUND_LOCATION (Android 10+)
- Required for geofence events to fire when the app is backgrounded or killed.
- Must be requested **after** foreground location is granted — Android enforces this two-step flow.
- Google Play Store requires a declared use-case and privacy policy for background location. Plan an in-app rationale screen before the OS dialog.

---

## Battery Strategy

Continuous location polling is not used at any point. Only OS-delivered geofence ENTER/EXIT events fire — hardware-efficient, using cell towers, WiFi, and GPS fusion via Play Services.

The app stores exactly **two timestamps per visit**: `entered_at` (ENTER event) and `exited_at` (EXIT event). No track logs, no background loops. Duration is computed at exit time.

---

## Auto-Complete Logic

```
On ENTER event (background task):
  → load geofence_locations row by region.identifier
  → INSERT geofence_log: { id, geofenceId, templatePermanentId, entered_at: now, exited_at: NULL }

On EXIT event (background task):
  → UPDATE geofence_log SET exited_at = now
      WHERE geofenceId = region.identifier AND exited_at IS NULL
  → duration = exited_at − entered_at (ms → minutes)
  → load threshold_minutes from geofence_locations
  → if duration < threshold → stop, do nothing
  → findTodaysPendingInstance(templatePermanentId)
      (same query as HC sprint-7: tasks JOIN template_instances
       WHERE templateId = ? AND completed = 0 AND due_date BETWEEN midnight AND 23:59)
  → if pending instance found → completeTask(instance)   ← only coupling to perm tasks
  → if no pending instance (not scheduled or already done) → do nothing
  ── NEVER creates a new instance ──
```

---

## Storage — Geofencing-Only Tables

Two new tables, entirely within the geofencing feature. The `templates` table and all
permanent task tables are **not touched**.

```sql
-- One row per user-configured geofence location
-- Stores the link to a permanent task template + all geofence settings
CREATE TABLE IF NOT EXISTS geofence_locations (
  id                   TEXT    PRIMARY KEY,   -- UUID
  template_permanent_id TEXT   NOT NULL,      -- references templates.permanentId (no FK constraint)
  label                TEXT    NOT NULL,      -- display name (e.g. "Gym", "Home")
  latitude             REAL    NOT NULL,
  longitude            REAL    NOT NULL,
  radius_metres        INTEGER NOT NULL DEFAULT 100,
  threshold_minutes    INTEGER NOT NULL DEFAULT 30,
  enabled              INTEGER NOT NULL DEFAULT 1,
  created_at           INTEGER NOT NULL       -- Unix ms
);

-- One row per geofence visit (entry + exit pair)
CREATE TABLE IF NOT EXISTS geofence_log (
  id           TEXT    PRIMARY KEY,
  geofence_id  TEXT    NOT NULL,   -- references geofence_locations.id
  entered_at   INTEGER NOT NULL,   -- Unix ms
  exited_at    INTEGER,            -- Unix ms; NULL until EXIT event fires
  synced_at    INTEGER NOT NULL
);
```

No foreign-key constraints — same pattern as `health_connect_mappings` referencing `templates.permanentId`.

---

## New Components

Everything lives in the geofencing feature area or the Browse page. No changes to any
permanent task screen, component, or file.

| Component | Purpose |
|-----------|---------|
| `GeofencingScreen` | Browse hub — lists all configured geofence locations, status badge, add/edit/delete, permission status. Same hub pattern as `HealthManagementScreen`. |
| `GeofenceDetailScreen` | Per-location detail — shows visit log, dwell time history |
| `LocationPickerScreen` | `react-native-maps` + OSM UrlTile; pin drop; radius slider; Nominatim search bar; template selector (picks from existing perm templates) |
| `GeofenceService` | Registers/unregisters geofences via `expo-location`; defines the `expo-task-manager` background task; handles ENTER (write entered_at) and EXIT (write exited_at, evaluate threshold, call `completeTask`) |
| `GeofenceStorage` | Reads/writes `geofence_locations` and `geofence_log`. No reads from templates — only stores the `permanentId` string as a reference key. |
| `GeofencePermissionScreen` | In-app rationale before requesting `ACCESS_BACKGROUND_LOCATION` |

---

## Libraries

| Library | Purpose |
|---------|---------|
| `expo-location` | Foreground location permission; `startGeofencingAsync` |
| `expo-task-manager` | Background task definition for geofence events |
| `react-native-maps` | Map view in `LocationPickerScreen` (OSM tiles via `UrlTile`) |
| `expo-notifications` | Optional notification on threshold met |

None are installed yet — all need adding to `package.json`.

---

## Permissions Required

- `ACCESS_FINE_LOCATION` (Android) — foreground; declared in `app.json`
- `ACCESS_BACKGROUND_LOCATION` (Android 10+) — required for background geofence events; triggers Play Store review process
- `NSLocationAlwaysAndWhenInUseUsageDescription` (iOS) — background location; required in `app.json`
- `POST_NOTIFICATIONS` (Android 13+) — if arrival notification is added

---

## Data Flow

```
Browse page → Geofencing hub (GeofencingScreen)
    → user taps "Add Location"
    → LocationPickerScreen opens
        → user selects a permanent task template from a picker
           (reads template names for display only — no writes to templates)
        → user searches for a place (Nominatim) or drops a pin
        → user adjusts radius slider
        → user sets dwell threshold (minutes)
        → GeofenceStorage.saveLocation() → INSERT geofence_locations row
        → GeofenceService.reregister() → startGeofencingAsync with updated regions

App startup:
    GeofenceService.reregisterAll()
        → GeofenceStorage.getAllEnabled() → SELECT * FROM geofence_locations WHERE enabled = 1
        → startGeofencingAsync with those regions
        (geofences cleared on reboot — must re-register every launch)

Background (app closed or backgrounded):
    expo-task-manager GEOFENCE_TASK
        ENTER → GeofenceStorage.insertLog(entered_at)
        EXIT  → GeofenceStorage.updateLog(exited_at)
               → evaluate threshold
               → if met: taskActions.completeTask(pendingInstance)
                         ↑ only line that touches the permanent task layer
```

---

## Task List

- [ ] Install `expo-location`, `expo-task-manager`, `react-native-maps`
- [ ] Create `geofencing` schema file — `geofence_locations` + `geofence_log` tables
- [ ] Add `initializeGeofencingSchema()` to `initializeAllSchemas()` in schema `index.ts`
- [ ] Build `GeofenceStorage` — CRUD for `geofence_locations` and `geofence_log`
- [ ] Build `GeofenceService` — register/unregister, ENTER handler, EXIT handler + threshold evaluation + `completeTask` call
- [ ] Define `expo-task-manager` background task in `index.ts` (module level, before app start)
- [ ] Re-register all geofences on app startup
- [ ] Build `GeofencingScreen` (Browse hub — list, status, add/delete, permission banner)
- [ ] Build `LocationPickerScreen` (react-native-maps + OSM UrlTile + Nominatim search + template picker + radius + threshold)
- [ ] Build `GeofencePermissionScreen` (rationale before background location request)
- [ ] Wire `GeofencingScreen` into Browse page navigation
- [ ] Handle Play Services unavailable gracefully
- [ ] iOS eviction strategy for >20 geofences
- [ ] Test on physical Android device (geofencing does not work in emulator)

---

## Known Limitations

- **iOS**: 20 geofence limit — eviction strategy needed for users with many locations
- **Android background location**: Users may deny `ACCESS_BACKGROUND_LOCATION`; disable that geofence and show explanation in the hub
- **Play Services required on Android**: Hard dependency; no workaround
- **Reboot clears geofences**: Must re-register on every app open
- **Indoor accuracy**: May be poor indoors or in dense urban environments
- **Stale log rows**: If device reboots while user is inside a geofence, the `exited_at` is never written. Any `geofence_log` row where `entered_at` is from a previous calendar day and `exited_at IS NULL` is stale and should be discarded, not evaluated.
