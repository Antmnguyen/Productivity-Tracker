# Sprint 4 Progress: Statistics Preview Cards

**Branch:** `sprint$` tinuing)
**Phase:** 2 — Reusable Components + Stats List Screen (partial)

---

## What Was Built

### StatPreviewCard — the repeating block

Each stat entity (All Tasks, a template, a category) gets one card. The card is tappable (wired to a placeholder handler, ready for `StatDetailScreen` navigation in a later phase).

```
┌───────────────────────────────────────────┐
│  [Ring]  All Tasks                🔥 12   │
│   78%    156 completed                    │
│  ─────────────────────────────────────── │
│  [M] [T] [W] [T] [F] [S] [S]            │
└───────────────────────────────────────────┘
```

Cards appear in three sections on `StatsScreen`:
- **OVERALL** — one "All Tasks" card
- **PERMANENT TASKS** — one card per template
- **CATEGORIES** — one card per category, using the category's own color

---

## Files Created

### `app/components/stats/CircularProgress.tsx`
Ring progress indicator. Grey track, accent arc fills clockwise from **12 o'clock** as percent increases.

**Technique:** Two half-ring clip boxes, each containing a full ring with only two border sides colored. Clip boxes restrict each ring to its respective half (right = 0–50%, left = 50–100%). Rings rotate into view as percent increases. A white inner disc sits on top to create the ring hole and renders the `%` label.

**Key rotation formula** (derived from the 90° arc each border side occupies on a perfect circle):
```ts
const rightRotation = -135 + Math.min(angle, 180);
const leftRotation  = -135 + Math.max(0, angle - 180);
```
- At 0%: both arcs rotate fully into the opposite half → nothing visible → grey track only ✓
- At 50%: right arc realigns to right D-shape → right half filled ✓
- At 100%: both halves filled ✓

Props: `percent`, `size` (default 64), `color`, `trackWidth` (default 7)

---

### `app/components/stats/WeeklyMiniChart.tsx`
7-bar Mon–Sun chart. Exports `DayData` type.

**Bar sizing:** Relative to the week's max count — the busiest day always gets the full bar height, all other days scale proportionally. Zero-completion days show a 3px grey stub.

```ts
const maxCount = Math.max(...data.map(d => d.count), 1);
barHeight = (item.count / maxCount) * maxHeight;
```

Day labels (M T W T F S S) sit below bars.

Props: `data: DayData[]`, `color`, `maxHeight` (default 28), `barWidth` (default 13)

**`DayData` type:**
```ts
interface DayData {
  day: string;   // 'M' | 'T' | 'W' | 'T' | 'F' | 'S' | 'S'
  count: number; // raw completions that day (not a percent)
}
```

---

### `app/components/stats/StatPreviewCard.tsx`
Combines `CircularProgress` + `WeeklyMiniChart` into the tappable card. Exports `StatPreviewData` and `StatType` for `StatsScreen`.

**`StatPreviewData` type:**
```ts
interface StatPreviewData {
  type: 'all' | 'template' | 'category';
  id: string;
  name: string;
  totalCompleted: number;
  completionPercent: number; // 0–100, drives the ring fill
  currentStreak: number;
  weeklyData: DayData[];     // 7 items Mon–Sun
  color: string;             // accent color for ring + bars
}
```

---

## Files Modified

### `app/screens/stats/StatsScreen.tsx`
Replaced the placeholder with a scrollable list of `StatPreviewCard`s.

Mock data lives in three clearly named functions — swap these for real backend calls in Sprint 4 Phase 3:

| Function | Replace with |
|----------|-------------|
| `getMockOverallStats()` | `useStats().getAllTasksStats()` |
| `getMockTemplateStats()` | `useStats().getTemplateStatsList()` |
| `getMockCategoryStats()` | `useStats().getCategoryStatsList()` |

`handleCardPress(data)` logs the tap — navigation to `StatDetailScreen` wired here in Phase 5.

---

## Fixes Made

### CircularProgress — 12 o'clock start alignment
**Problem:** Old formula `Math.min(angle, 180) - 90` placed the right arc at -90° at 0%, which left part of the arc visible through the right clip. Fill did not start from 12 o'clock.

**Root cause:** Each border side on a perfect circle (`borderRadius = size/2`) covers exactly a 90° arc, divided at the 45° diagonals. `borderTop + borderRight` naturally sits at 315°→135° (the right D-shape). At -90° rotation this arc overlaps with the right clip, showing accent immediately at 0%.

**Fix:** Derived the correct offset by finding the rotation where the arc is entirely in the opposite half:
```
Old: rightRotation = Math.min(angle, 180) - 90    ← wrong
New: rightRotation = -135 + Math.min(angle, 180)  ← correct
```

### WeeklyMiniChart — count-based bars
**Problem:** Bars were sized by `percent` (0–100), which is a derived completion rate. Not intuitive or meaningful as a visual.

**Fix:** Changed `DayData.percent` → `DayData.count` (raw completions). Bar height is now relative to the week's maximum count, so the chart visually shows which days were busiest in absolute terms.

---

---

## Graph Navigation Refactor *(2026-02-20)*

All three graph components now have period navigation **built directly into the card** — no external navigator component required.

### `WeekBarGraph`
- New nav row between the section title and bars: `‹  Feb 10 – Feb 16, 2026  ›`
- Visual matches the standalone `WeekNavigator` (fafafa background, subtle border)
- `›` disabled on the current week
- Past-week data generated from a stable integer seed (week number since epoch) — same week always renders identical values
- New optional props: `initialWeekStart?: Date`, `onWeekChange?: (weekStart: Date) => void`

### `MonthCalendarGraph`
- `‹` / `›` arrows integrated inline with the existing month/year title: `‹  January 2026  ›`
- `monthTitle` has `minWidth: 130, textAlign: 'center'` — arrows stay fixed regardless of month name length
- `›` disabled on the current month; past months use seeded mock data
- New optional prop: `onMonthChange?: (year: number, month: number) => void`
- **Ring rendering:** Uses the **transparent-border technique** — a single `View` with `borderRadius` + per-side `borderColor`. This is the canonical approach. The OS renders per-side borders as one continuous path, producing naturally rounded inner corners. Do not revert to the five-segment clip-box approach.

### `YearOverviewGraph`
- `‹` / `›` arrows integrated with a year label: `‹  2026  ›`
- "YEAR OVERVIEW" / "YEAR COMPLETION RATE" mode label moved to a subtitle row below the nav
- `›` disabled on the current year; past years use seeded mock data (6–28 completions/month)
- New optional props: `initialYear?: number`, `onYearChange?: (year: number) => void`

### Shared mock-data strategy for navigation
Each graph uses `Math.sin(seed + 1) * 10000` hashing to derive stable, consistent values for any past period. The seed is derived from the period's unique integer representation (week number, `year*10000 + month*100 + day`, `year*100 + month`). Current-period data always uses the real `data` prop unchanged.

---

## What's Next (Sprint 4 remaining phases)

| Phase | Work |
|-------|------|
| Phase 1 | Storage layer — `statsStorage.ts`, `statsCalculations.ts`, `useStats.ts` |
| Phase 3 | Connect `StatsScreen` to real data (replace mock functions) |
| Phase 4 | Detail screen components — `CompletionSummaryCard`, `TimeCompletionsCard`, graphs |
| Phase 5 | `StatDetailScreen` + navigation from card tap |
| Phase 6 | Empty states, loading states, edge cases |
