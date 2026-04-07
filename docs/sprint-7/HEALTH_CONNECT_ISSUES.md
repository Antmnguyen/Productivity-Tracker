# Health Connect — Known Issues
**Last updated:** 2026-04-06

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

## ~~Bug 4 — WeekBarGraph `%` mode shows partial percentage for health data (should be 100% or 0%)~~ ✅ FIXED

**Fix applied 2026-04-06:**
- `barData` in both `StepsDetailScreen` and `SleepDetailScreen` now snaps `count` to `goal` (when met) or `0` (when not met)
- `safePct(goal, goal) = 100%`, `safePct(0, goal) = 0%` — WeekBarGraph unchanged
- Bar height in Count mode is full or absent, which correctly visualises a binary daily goal

---

## ~~Bug 5 — `HealthDayOfWeekCard` % mode should show goal-met rate, not avg-as-%-of-goal~~ ✅ FIXED

**Fix applied 2026-04-06:**
- `goalMetCount: number` added to `HealthDayOfWeekData` interface (`HealthDayOfWeekCard.tsx`)
- Both screens' `dayOfWeekData` useMemo now tracks `goalMet[dow]++` when the daily goal is met, and includes `goalMetCount` in each entry; deps array updated to include `stepsGoal`/`sleepGoal`
- `DayBar` % mode now uses `goalMetRate = goalMetCount / count`; bar height = `rate × BAR_MAX_HEIGHT`, label = `Math.round(rate × 100)%`
- `bestDayIndex` % branch now ranks by `goalMetCount / count`
- Card title in % mode: `GOAL MET RATE BY DAY OF THE WEEK (ALL TIME)`
- Footer in % mode: `Goal met most often: [day]`
