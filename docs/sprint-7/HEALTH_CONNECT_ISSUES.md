# Health Connect — Known Issues
**Last updated:** 2026-04-12

---

## Phase 5 — Manual Device Testing (NOT STARTED)

All 24 tests below require a physical Android device with Health Connect installed and real data
synced. Run them in order — earlier tests cover the plumbing that later tests depend on.

### Steps
| # | Test | Status |
|---|------|--------|
| T1 | Walk to a step count → app-start sync → ring updates, green when goal met | `[ ]` |
| T2 | Week bar graph shows bars for each day; goal-met days show green fill via MonthCalendarGraph logic | `[ ]` |
| T3 | Goal colour toggle off → all calendar cells revert to accent colour | `[ ]` |
| T4 | Monthly calendar cells: goal-met days green (≥60% fill), partial days yellow/red | `[ ]` |
| T5 | Week avg + month avg values match manual calculation from stored rows | `[ ]` |
| T6 | Add mapping → reach step goal → mapped task auto-completes (today only) | `[ ]` |
| T7 | Instance from yesterday with same template NOT completed by today's sync | `[ ]` |

### Sleep
| # | Test | Status |
|---|------|--------|
| T8 | Log overnight sleep → open app → last-night ring shown, green when goal met | `[ ]` |
| T9 | Week bar graph + monthly calendar colouring mirrors goal status | `[ ]` |
| T10 | Goal colour toggle off → all cells revert to accent colour | `[ ]` |
| T11 | Add mapping → sleep meets threshold → today's task auto-completes | `[ ]` |
| T12 | Session 11 PM–7 AM → counted for "today" (endTime filter working) | `[ ]` |
| T13 | No sleep data → ring shows 0/goal, no crash | `[ ]` |

### Workouts
| # | Test | Status |
|---|------|--------|
| T14 | Log workout → sessions list shows correct type label + duration | `[ ]` |
| T15 | Workout mapping completes today's instance, not yesterday's recurring instance | `[ ]` |
| T16 | `autoSchedule = true` with no instance today → default created + completed | `[ ]` |

### Sync correctness
| # | Test | Status |
|---|------|--------|
| T17 | User manually completes task → next sync does NOT double-complete it | `[ ]` |
| T18 | Open app twice after threshold met → task NOT double-completed | `[ ]` |
| T19 | Background sync fires → task list refreshes automatically (DeviceEventEmitter) | `[ ]` |
| T20 | Permission denial → no crash, Health screen shows status correctly | `[ ]` |

### Edge cases
| # | Test | Status |
|---|------|--------|
| T21 | Repeatable template → next occurrence scheduled after HC auto-complete | `[ ]` |
| T22 | Delete template with mapping → orphan invisible to sync, cleaned on Health screen open | `[ ]` |
| T23 | Dark mode: all health screens render correctly with theme colours | `[ ]` |
| T24 | Light mode: same screens, no hardcoded colours bleeding through | `[ ]` |

---

## ~~Bug 1 — Task mappings show `permanentId` instead of task name~~ ✅ FIXED

**Fix applied 2026-04-06:**
- `templateTitle?: string` added to `HealthConnectMapping` (`healthConnect.ts`)
- `getAllMappings()` and `getAllEnabledMappings()` now `SELECT m.*, t.templateTitle` (`healthConnectStorage.ts`)
- `rowToMapping()` populates the field (`healthConnectStorage.ts`)
- `MappingRow` in all three detail screens renders `mapping.templateTitle ?? mapping.permanentId`

---

## ~~Bug 2 — Week navigation changes the label but not the chart data~~ ✅ FIXED

**Fix applied 2026-04-06:**
- `selectedWeekStart: string` state added to both screens (init: `startOfCurrentWeek()`)
- `selectedWeekRows` derived via `useMemo` — calls `getStepsInRange` / `getSleepInRange` for `selectedWeekStart → selectedWeekStart+6d`
- `barData` now depends on `selectedWeekRows` instead of the always-current `weekRows`
- `onWeekChange={(monday) => setSelectedWeekStart(toLocalDateString(monday))}` wired into `WeekBarGraph` in both screens
- `addDays(dateStr, n)` module-level helper added to each screen file (constructs via date parts, no UTC shift)
- `weekRows` (current calendar week) retained for the stats row and streak card — those always show the current week regardless of which week is being browsed

---

## ~~Bug 3 — Auto-completer creates a duplicate instance when task is already completed today~~ ✅ FIXED

**Fix applied 2026-04-06:**
- Added `hasTodaysInstance(permanentId)` in `healthConnectActions.ts` — queries tasks + template_instances for today's window with **no** `completed` filter, returns `boolean`
- `autoSchedule` branch in `sync()` now guarded: `else if (mapping.autoSchedule && !hasTodaysInstance(mapping.permanentId))`
- Result: if an instance exists today (completed or pending), the sync leaves it alone; only creates a new instance when truly none exists

---

## ~~Bug 4 — WeekBarGraph bars and % mode for health data~~ ✅ FIXED (revised)

**Original symptom:** % mode showed partial percentages (e.g. 84%) instead of meaningful health goal feedback.

**First attempt (reverted):** Snapped `count` to `goal` or `0` — produced binary 100%/0% but broke Count mode (bars showed goal value instead of real steps, full or empty only).

**Final fix applied 2026-04-06:**

`DayData` (`WeeklyMiniChart.tsx`):
- Added `barColor?: string` — optional per-bar color override. Existing callers pass nothing and are unaffected; `WeekBarGraph` falls back to the graph-level `color` prop when absent.

`WeekBarGraph.tsx` (`BarColumn`):
- Bar background: `item.barColor ?? color`
- Value label color: same fallback
- % bar height capped at `BAR_MAX_HEIGHT` (prevents overflow when `count > total`)
- % label capped: `Math.min(safePct(count, total), 100)%`

`StepsDetailScreen` + `SleepDetailScreen` (`barData`):
- `count` = actual steps/hours — Count mode shows real values, bars scale to busiest day
- `total` = goal — % mode shows `actual ÷ goal`, capped at 100%
- `barColor` = `GOAL_MET_COLOR` (`'#34C759'`) when goal met + colour toggle on; `undefined` otherwise (falls back to `HC_COLOR`)

**⚠️ Regression check required:** `barColor` was added to the shared `DayData` type used by all stat screens (`OverallDetailScreen`, `CategoryDetailScreen`, `PermanentDetailScreen`). Those screens do not set `barColor`, so `WeekBarGraph` falls back to `color` as before — but this must be verified on device:
- [ ] Overall stats week bar graph — bars still colour correctly
- [ ] Category detail week bar graph — bars still colour correctly
- [ ] Permanent task detail week bar graph — bars still colour correctly
- [ ] Stacked-segment bars (permanent + one-off split) — still render correctly (code path unchanged, `barColor` only applies to the solid-bar branch)

---

## Bug 6 — Steps data saved today gets wiped by a later failed sync ✅ FIXED

**Symptom:** Steps (and sometimes sleep) data is visible today but disappears the next day. The data was correctly read from Health Connect and displayed — but yesterday's bar in the chart shows 0 the following day. Happens inconsistently (not every day), which is the tell.

**Root cause:** `getTodaySummary()` initialises `steps = 0` at the top and silently swallows HC read errors:

```ts
// getTodaySummary() — healthConnectActions.ts
let steps = 0;
try {
  const stepsResult = await readRecords('Steps', { ... });
  for (const record of stepsResult.records) steps += record.count ?? 0;
} catch (e) {
  console.warn('[HC] Steps read failed:', e);
  // steps stays 0 — no rethrow
}
```

Then `sync()` unconditionally upserts whatever value is returned — including 0:

```ts
// sync() — healthConnectActions.ts
upsertStepsForDate(today, summary.steps);   // ← saves 0 if HC read failed
if (summary.sleepHours > 0) {              // ← sleep has a guard; steps does not
  upsertSleepForDate(today, summary.sleepHours);
}
```

Sync fires multiple times per day (app start, every foreground, background fetch every 15 min). If any one of those syncs fails to read steps from HC (permissions not ready, HC flaking, headless background task before DB is fully warm), it writes 0 and overwrites the previously correct value. Next day, yesterday shows 0.

**Fix plan — `sync()` in `healthConnectActions.ts` only:**

1. **Add a `> 0` guard to the steps upsert**, matching the existing sleep guard:
   ```ts
   if (summary.steps > 0) {
     upsertStepsForDate(today, summary.steps);
   }
   ```
   This stops a failed HC read (returning 0) from ever overwriting a valid stored count.

2. **Better: use a MAX-wins upsert for steps** so the stored value can only ever increase within a day (steps only go up). Change `upsertStepsForDate` in `healthConnectStorage.ts` from `INSERT OR REPLACE` to:
   ```sql
   INSERT INTO health_steps_log (date, steps, synced_at)
   VALUES (?, ?, ?)
   ON CONFLICT(date) DO UPDATE SET
     steps     = MAX(steps, excluded.steps),
     synced_at = excluded.synced_at
   WHERE excluded.steps > 0;
   ```
   - `WHERE excluded.steps > 0` — never overwrites a stored value with 0.
   - `MAX(steps, excluded.steps)` — never decreases a day's count (a later partial sync returning 5000 steps won't overwrite a stored 10000).
   - First insert for a date is unaffected (no conflict row to compare).

3. **Apply the same MAX-wins upsert to sleep** for consistency:
   ```sql
   INSERT INTO health_sleep_log (date, sleep_hours, synced_at)
   VALUES (?, ?, ?)
   ON CONFLICT(date) DO UPDATE SET
     sleep_hours = MAX(sleep_hours, excluded.sleep_hours),
     synced_at   = excluded.synced_at
   WHERE excluded.sleep_hours > 0;
   ```
   The existing `> 0` guard in `sync()` can stay — defence in depth.

**Files to change:**
- `app/core/services/storage/healthConnectStorage.ts` — `upsertStepsForDate` and `upsertSleepForDate` SQL only.
- `app/features/googleFit/utils/healthConnectActions.ts` — optionally add `if (summary.steps > 0)` guard as a belt-and-suspenders check.

**Fix applied 2026-04-12:**
- `upsertStepsForDate` in `healthConnectStorage.ts` — changed from `INSERT OR REPLACE` to `INSERT … ON CONFLICT DO UPDATE SET steps = MAX(steps, excluded.steps) WHERE excluded.steps > 0`. Stored value can never decrease and can never be overwritten by 0.
- `upsertSleepForDate` in `healthConnectStorage.ts` — same MAX-wins pattern applied.
- `sync()` in `healthConnectActions.ts` — added `if (summary.steps > 0)` guard before the steps upsert call (belt-and-suspenders; sleep already had this guard).

**Test:** Walk enough to hit a real step count. Note the count in the app. Reboot the device (forces a cold background-fetch sync). Open the app the next day. Confirm yesterday's bar shows the correct count, not 0.

---

## Bug 7 — Steps are double-counted because sync uses raw session records ✅ FIXED

**Symptom:** Today's step count shown in the ring and stats is roughly 2× (or more) the actual step count reported by the Health Connect app. The discrepancy grows through the day as more raw records accumulate.

**Root cause:** `sync()` currently reads steps using the raw `StepsRecord` history API and sums all records whose time window overlaps the target day. Health Connect stores multiple overlapping records from different sources (phone pedometer, Wear OS, third-party apps). Summing raw records double- or triple-counts steps that are already merged inside Health Connect.

**Fix plan:**
1. **Switch to the Health Connect aggregate API for steps.** Replace the raw `readRecords('Steps', ...)` call in `sync()` with `aggregateGroupByPeriod` (or `aggregate`) using the `STEPS_COUNT_TOTAL` metric and a `PERIOD_DAY` bucket. Health Connect deduplicates and merges overlapping sources automatically when using the aggregate endpoint.
   ```ts
   // Before (raw — double-counts):
   const raw = await readRecords('Steps', { timeRangeFilter });
   const total = raw.reduce((sum, r) => sum + r.count, 0);

   // After (aggregate — deduped):
   const result = await aggregateGroupByPeriod({
     metrics: [STEPS_COUNT_TOTAL],
     timeRangeFilter,
     timeRangeSlicer: { duration: 'DAYS', count: 1 },
   });
   const total = result[0]?.result[STEPS_COUNT_TOTAL] ?? 0;
   ```
2. **Apply the same pattern to the 30-day backfill** (Bug 6 fix) — use `aggregateGroupByPeriod` with a 30-day range and `PERIOD_DAY` bucketing to get one deduplicated value per day in a single call.
3. **Do not change sleep reads** — sleep uses session-based records which do not overlap in the same way; raw `SleepSessionRecord` reads are correct for sleep.
**Fix applied 2026-04-12:**
- Added `aggregateGroupByPeriod` to the `react-native-health-connect` import in `healthConnectActions.ts`.
- Replaced the `readRecords('Steps', ...)` loop in `getTodaySummary()` with `aggregateGroupByPeriod({ recordType: 'Steps', timeRangeSlicer: { period: 'DAYS', length: 1 } })`. Result key is `COUNT_TOTAL` on the first (and only) bucket.
- Sleep reads remain as raw `SleepSession` records — sleep sessions don't overlap in the same way, so raw reads are correct there.

**Test:** Compare the value stored in `health_steps_log` after a sync against the total shown in the Health Connect app's own UI — they should match within a few steps.

---

## ~~Bug 5 — `HealthDayOfWeekCard` % mode should show goal-met rate, not avg-as-%-of-goal~~ ✅ FIXED

**Fix applied 2026-04-06:**
- `goalMetCount: number` added to `HealthDayOfWeekData` interface (`HealthDayOfWeekCard.tsx`)
- Both screens' `dayOfWeekData` useMemo now tracks `goalMet[dow]++` when the daily goal is met, and includes `goalMetCount` in each entry; deps array updated to include `stepsGoal`/`sleepGoal`
- `DayBar` % mode now uses `goalMetRate = goalMetCount / count`; bar height = `rate × BAR_MAX_HEIGHT`, label = `Math.round(rate × 100)%`
- `bestDayIndex` % branch now ranks by `goalMetCount / count`
- Card title in % mode: `GOAL MET RATE BY DAY OF THE WEEK (ALL TIME)`
- Footer in % mode: `Goal met most often: [day]`
