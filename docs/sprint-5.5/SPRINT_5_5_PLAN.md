# Sprint 5.5 — Bug Fixes & Usability

**Goal:** Resolve known bugs and usability gaps surfaced after Sprint 5 delivery.

**Status key:**
- `[ ]` Not started
- `[~]` In progress
- `[x]` Done
- `[!]` Blocked

---

## Small Fixes

_Fast, low-risk corrections. Target: all completed before Medium work begins._

| # | Task | Status |
|---|------|--------|
| S1 | Very slightly reduce the history bar tab height at the top so it fits better | `[x]` |
| S2 | Repeat task — initial creation of a permanent task does not properly save the repeatability status on creation (editing saves fine, only creation is broken) | `[x]` |
| S3 | "Use permanent task" is being double-counted on creation and completion — remove the creation increment so it only increments upon completion (this is separate from the main stats counter, likely in perm task actions) | `[x]` |
| S4 | Stats screen — white circle text on percent value glitches visually | `[]` |
| S5 | Month view — completion fill should be continuous, not rounded to 4 discrete states (0, 1/4, 2/4, 3/4, 4/4). Keep the shape exactly the same, only change the fill logic to be continuous | `[x]` |

---

## Medium Fixes

_Meaningful features or multi-part bugs. Each should be scoped and tracked individually._

| # | Task | Status | Notes |
|---|------|--------|-------|
| M1 | Week completions (category, tasks, weekly average) — data is not retrieved correctly when scrolling left/right; only the current week displays properly. Data exists (other stats access it fine) and processing is correct (current week is accurate) | `[ ]` | |
| M2 | Undoing a permanent task in the visual scene does not revert the stats collection for that task — undo must properly revert the recorded values | `[ ]` | |
| M3 | Today tab — add a fourth button alongside "Today / This Week / This Month" labelled "Choose Date". Selecting a date toggles it as the active reference date; Today/This Week/This Month then display relative to the chosen date. Default reference date is the current date. Reuse the existing date-picker used for task assignment | `[x]` | | Implement a similar date selection feature for history screen with the same logic displaying history of selected dates `[x]`
| M4 | Task lists and permanent tasks — sort/group by category so same-category items are adjacent. Secondary sort: completion status still takes priority (incomplete on top, complete on bottom); within each completion group, items are sorted by category. Use Permanent Tasks screen should follow the same scheme | `[]` | |
| M5 | Task deletion — replace current delete interaction with a toggle-based flow to prevent accidental deletes: toggle on → select tasks → confirm delete. Toggle/button placement: corner button or part of the floating create-task button, whichever looks best | `[ ]` | |
| M6 | Edit task functionality for permanent tasks on the main screen — extend editing to include toggling and editing the repeatability of the task. Also consider expanding edit to allow changing categories for both temporary and permanent tasks | `[ ]` | |

---

## Large Fixes

_Complex, higher-risk work. Requires focused investigation before implementation._

| # | Task | Status | Notes |
|---|------|--------|-------|
| L1 | Streaks — not being calculated correctly | `[ ]` | Investigate root cause before touching logic |
| L2 | Repeatable tasks — broken in multiple places across the app | `[ ]` | Audit all repeat-task code paths first |

---

## Progress Tracking

**Small:** 0 / 5 done
**Medium:** 0 / 6 done
**Large:** 0 / 2 done
**Total:** 0 / 13 done

Update the table statuses and the counts above as work completes. Move items to `[~]` when actively in progress and `[x]` when merged/verified.
