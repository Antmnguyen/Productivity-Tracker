# Sprint 7 — Next Steps
**Date:** 2026-03-30

**Status entering this session (updated 2026-04-05):** Phase 1 types + storage complete. Phase 2 (actions) next.

**Original status (2026-03-30):** Setup complete. Permissions granted (Steps, StepsCadence, SleepSession). SDK verified. Screen is clean placeholder. No feature code written yet.

---

## Phase 1 — Types + Storage Layer `[x]`

### `app/features/googleFit/types/healthConnect.ts` `[x]`
- `HealthDataType`, `ExerciseTypeValue`, `ExerciseTypeMap`
- `HealthConnectMapping`, `WorkoutSession`, `TodaySummary`, `HealthConnectStatus`

### `app/core/services/storage/schema/healthConnect.ts` `[x]`
Schema init for four tables:
```
health_connect_mappings  — threshold → template assignments
health_connect_meta      — key-value store (goals, colour toggles, last_synced_at)
health_steps_log         — one row per 'YYYY-MM-DD', total step count for that day
health_sleep_log         — one row per 'YYYY-MM-DD' (morning), sleep hours for that night
```
Registered as Step 7 in `app/core/services/storage/schema/index.ts`.

Steps/sleep history tables are upserted on every sync so stats survive Health Connect
being wiped (which happens regularly on test devices and after reinstalls).

### `app/core/services/storage/healthConnectStorage.ts` `[x]`
Public API:

**Mappings:**
- `saveMapping(mapping)` — upsert
- `deleteMapping(id)`
- `getAllEnabledMappings()` — INNER JOIN against templates to filter orphans
- `getAllMappings()` — all rows for UI display
- `pruneOrphanedMappings()` — delete rows whose permanentId no longer exists

**Meta:**
- `getLastSyncedAt()` / `setLastSyncedAt(iso)`
- `getStepsGoal()` / `setStepsGoal(n)` — display goal (default 10000)
- `getSleepGoal()` / `setSleepGoal(h)` — display goal in hours (default 8)
- `getStepsColorEnabled()` / `setStepsColorEnabled(b)`
- `getSleepColorEnabled()` / `setSleepColorEnabled(b)`

**Steps history:**
- `upsertStepsForDate(date, steps)` — called by sync after summing HC intervals
- `getStepsInRange(from, to)` → `StepsDayRecord[]` — used by charts + stats
- `getStepsPersonalBest()` → `StepsDayRecord | null`

**Sleep history:**
- `upsertSleepForDate(date, sleepHours)` — called by sync
- `getSleepInRange(from, to)` → `SleepDayRecord[]` — used by charts + stats
- `getSleepPersonalBest()` → `SleepDayRecord | null`

> **Architecture note:** Schema lives in `core/services/storage/schema/` and storage
> layer in `core/services/storage/` — same pattern as categories and permanentTask.
> Types remain in `app/features/googleFit/types/` as they are feature-specific.

---

## Phase 2 — Health Connect Actions

### `app/features/googlefit/utils/healthConnectActions.ts`

Implement the four public functions:

| Function | Notes |
|---|---|
| `checkStatus()` | Call `getSdkStatus()` → map to `HealthConnectStatus` enum |
| `requestPermissions(dataTypes)` | Wraps `requestPermission()` with the `READ_*` permission strings |
| `getTodaySummary()` | Steps: sum `count` across intervals since midnight. Sleep: 24h lookback, filter `endTime >= today`. Workouts: `ExerciseSessionRecord` since midnight. |
| `sync()` | Check status → get summary → for each mapping call `evaluateThreshold()` → complete or auto-schedule |

Key detail for `sync()`:
- Use `findTodaysPendingInstance(permanentId)` to find today's instance (filters `completed = 0`)
- If threshold met + instance found → `taskActions.completeTask(instance.id)`
- If threshold met + no instance + `autoSchedule = true` → create default instance then complete
- If already completed → `findTodaysPendingInstance` returns null → do nothing (no double-completion)

---

## Phase 3 — Screen UI

### Replace `app/screens/browse/HealthManagementScreen.tsx`

The main Health Connect screen is a **hub** — connection status + three tappable
section rows. No collapsible cards. Tapping a row navigates to the full detail screen.

```
HealthManagementScreen
  HealthConnectStatusBadge
  HealthSectionRow (Steps)   → StepsDetailScreen
  HealthSectionRow (Sleep)   → SleepDetailScreen
  HealthSectionRow (Workouts) → WorkoutsDetailScreen
  [Sync Now]  "Last synced: X min ago"
```

### Create `app/screens/browse/StepsDetailScreen.tsx`

Full-screen steps detail (pushed via navigation):
- `CircularProgress` ring (green when `todaySteps >= stepsGoal` AND colour toggle on)
- Editable goal field + goal colour toggle (persisted to `health_connect_meta`)
- Week/Month toggle (`TimeRangePicker` reused)
- `WeekBarGraph` — bars green for goal-met days when toggle on
- `MonthCalendarGraph` — cells green for goal-met days when toggle on
- Stats: week avg + month avg + `StreakCard` + personal best
- Mapping rows + `[+ Add Task Mapping]`

### Create `app/screens/browse/SleepDetailScreen.tsx`

Full-screen sleep detail:
- `CompletionSummaryCard` ring (green when goal met + toggle on)
- Editable sleep goal (hours) + goal colour toggle
- Sleep stage mini-bar (hidden if no stage data)
- Week/Month toggle, `WeekBarGraph`, `MonthCalendarGraph` (green when goal met + toggle on)
- Stats: week avg + month avg + `StreakCard` + best night
- Mapping rows + `[+ Add Task Mapping]`

### Create `app/screens/browse/WorkoutsDetailScreen.tsx`

Full-screen workouts detail:
- Today's sessions list (type label + duration), or "No workouts today"
- Mapping rows + `[+ Add Task Mapping]`
- No chart, no stats

### Create `app/screens/browse/HealthMappingEditor.tsx`

Modal/sub-screen for add/edit:
- Task picker → `getAllPermanentTemplates()` (read-only)
- Threshold fields (step goal / sleep hours / exercise type + min duration)
- Auto-schedule toggle
- Save / Delete buttons

Exercise type picker: iterate `ExerciseType` constants at runtime to build label map. Store integer values, not key strings.

> **Goal vs mapping threshold:** The section goal in `health_connect_meta` (the value
> the user sets in the detail screen) is the global display goal. Individual mappings
> in `health_connect_mappings` can have their own threshold — this allows mapping
> "Daily Walk" to 8,000 steps while the display goal is 10,000. Keep them independent.

---

## Phase 4 — Sync Wiring

Wire up sync in three places:

1. **App start** (`App.tsx` or `index.js`): call `healthConnectActions.sync()` as
   fire-and-forget after DB init. Do NOT await — must not block app render.
2. **AppState foreground** (`MainNavigator.tsx`): call `sync()` when `AppState`
   transitions to `'active'` (catch-up for edge cases).
3. **Background** (`react-native-background-fetch`): register task that calls `sync()`
   every 15 min (Android minimum interval).

---

## Order of Work

```
Phase 1 (types + storage)  →  Phase 2 (actions + goal settings)  →  Phase 3 (UI)  →  Phase 4 (sync wiring)
```

Start with Phase 1. Each phase is independently testable before moving to the next.

---

## Key Reminders

- Exercise type values are **integers** (e.g. `STRENGTH_TRAINING = 70`, `RUNNING = 56`)
- Steps are stored as **short intervals** — always sum `count` across all records for the day
- Sleep sessions span midnight — use the 24h lookback + `endTime >= startOfToday` filter
- `android/` is gitignored — `app.json` is the durable config for `minSdkVersion: 26`
- Permanent task layer is **never modified** — HC calls into it as a consumer only
- All health UI must use `useTheme()` — no hardcoded hex colours. Test dark + light mode.
- Workout auto-complete only targets today's instances — `getPendingInstanceByTemplateId` always receives `todayDateString()`
- Goal colour toggle controls visuals only — task auto-complete always runs regardless of toggle state
- App-start sync is fire-and-forget — never block the UI render on its completion
