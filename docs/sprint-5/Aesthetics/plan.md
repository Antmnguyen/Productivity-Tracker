# Sprint 5 — Aesthetics Plan

> **Status: PILLARS 1, 2 & 3 COMPLETE** — Dark mode, category colour strips, and permanent task visual identity all implemented. Pillar 4 (General Polish) is next.

---

## Overview

Four pillars:

| # | Feature | Summary | Status |
|---|---------|---------|--------|
| 1 | **Dark Mode** | Manual toggle in BrowseScreen, persisted via app_settings, full token system | ✅ Complete |
| 2 | **Category Color Strips** | Left accent strip on every task card and template row, coloured by the task's category | ✅ Complete |
| 3 | **Permanent vs One-Off Distinction** | Visual difference between recurring (permanent) tasks and one-off tasks in the task lists | ✅ Complete |
| 4 | **General Polish** | Completed task dimming, header consistency, empty state improvements | ⏳ Planned |

---

## 1 — Dark Mode

### Design change from original plan
The original plan called for system-following (`useColorScheme()` only).
**Changed to manual toggle**: a Dark Mode row in BrowseScreen lets the user
flip the theme themselves. Preference is persisted in `app_settings` under
key `dark_mode` (`'1'` = dark, `'0'` = light). On first launch with no stored
preference, the system colour scheme is used as the default.

### Goal
Every hardcoded colour (`#fff`, `#f5f5f5`, `#000`, etc.) is replaced by a
theme token so a single context switch re-skins the entire app.

### Architecture

**New directory: `app/theme/`** ✅ Created

```
app/theme/
  tokens.ts          ✅ Light + dark colour palettes (plain objects, no React)
  ThemeContext.tsx   ✅ React context + ThemeProvider + useTheme() hook
```

#### `app/theme/tokens.ts`

Defines two palettes — same key names, different values:

```typescript
export const lightTheme = {
  // ── Backgrounds ──────────────────────────────
  bgScreen:    '#f5f5f5',   // page background (between cards)
  bgCard:      '#ffffff',   // white card / list row
  bgModal:     '#f5f5f5',   // modal sheet background
  bgInput:     '#f0f0f0',   // input field background
  bgSection:   '#ffffff',   // form section card

  // ── Surfaces / Headers ────────────────────────
  // NOTE: primary tab colours stay the same in dark mode
  // (they are brand colours, not semantic surfaces)
  headerTasks: '#007AFF',   // All Tasks blue
  headerToday: '#34C759',   // Today green
  headerStats: '#FF9500',   // Stats orange
  headerBrowse:'#5856D6',   // Browse purple

  // ── Text ──────────────────────────────────────
  textPrimary:    '#000000',
  textSecondary:  '#666666',
  textTertiary:   '#888888',
  textDisabled:   '#bbbbbb',
  textOnHeader:   '#ffffff',
  textOnAccent:   '#ffffff',

  // ── Interactive ───────────────────────────────
  accent:         '#007AFF',   // primary blue action
  accentPermanent:'#5856D6',   // purple — permanent task badge/checkbox
  danger:         '#FF3B30',   // delete button

  // ── Borders / Separators ──────────────────────
  border:         '#dddddd',
  separator:      '#f0f0f0',
  hairline:       '#cccccc',

  // ── Task Card specific ───────────────────────
  checkboxBorderOneOff:   '#007AFF',
  checkboxFillOneOff:     '#007AFF',
  checkboxBorderPermanent:'#5856D6',
  checkboxFillPermanent:  '#5856D6',
  completedText:          '#999999',
  completedStrike:        true,

  // ── Category strip (no-category fallback) ────
  categoryStripNone: '#e0e0e0',
};

export const darkTheme: typeof lightTheme = {
  bgScreen:    '#1c1c1e',
  bgCard:      '#2c2c2e',
  bgModal:     '#1c1c1e',
  bgInput:     '#3a3a3c',
  bgSection:   '#2c2c2e',

  headerTasks:  '#007AFF',
  headerToday:  '#34C759',
  headerStats:  '#FF9500',
  headerBrowse: '#5856D6',

  textPrimary:   '#ffffff',
  textSecondary: '#ababab',
  textTertiary:  '#888888',
  textDisabled:  '#555555',
  textOnHeader:  '#ffffff',
  textOnAccent:  '#ffffff',

  accent:          '#0a84ff',   // iOS dark-mode blue
  accentPermanent: '#6e6cd8',
  danger:          '#ff453a',

  border:    '#3a3a3c',
  separator: '#3a3a3c',
  hairline:  '#444446',

  checkboxBorderOneOff:    '#0a84ff',
  checkboxFillOneOff:      '#0a84ff',
  checkboxBorderPermanent: '#6e6cd8',
  checkboxFillPermanent:   '#6e6cd8',
  completedText:           '#555555',
  completedStrike:         true,

  categoryStripNone: '#444446',
};

export type AppTheme = typeof lightTheme;
```

#### `app/theme/ThemeContext.tsx` ✅

**Actual implementation** (differs from original plan — manual toggle, not system-only):

```typescript
// Persists user preference in app_settings ('dark_mode' key).
// Falls back to useColorScheme() on first launch.
// Exposes { theme, isDark, toggleTheme } via context.

interface ThemeContextValue {
  theme:       AppTheme;
  isDark:      boolean;
  toggleTheme: () => void;    // ← added vs original plan
}

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const [isDark, setIsDark] = useState(() => {
    const stored = getAppSetting('dark_mode');
    if (stored !== null) return stored === '1';
    return systemScheme === 'dark';   // fallback to system on first launch
  });

  const toggleTheme = () => {
    setIsDark(prev => {
      const next = !prev;
      setAppSetting('dark_mode', next ? '1' : '0');
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme: isDark ? darkTheme : lightTheme, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
```

`ThemeProvider` wraps the root in `App.tsx`. ✅

#### Usage in components

Replace hardcoded colours with theme tokens:

```tsx
// BEFORE
container: { backgroundColor: '#fff' }
// AFTER
const theme = useTheme();
container: { backgroundColor: theme.bgCard }
```

Inline styles (for dynamic colours like category strip colours) use the same hook:

```tsx
const theme = useTheme();
<View style={{ width: 4, backgroundColor: task.categoryColor ?? theme.categoryStripNone }} />
```

---

## 2 — Category Color Strips ✅

### Goal
Every task card shows a coloured left strip matching its category colour.
If the task has no category, the strip is neutral grey.
This appears in:
- `AllTasksScreen` (via `TaskItem`)
- `TodayScreen` (via `TaskItem`)
- `UsePermanentTaskScreen` template rows (template-level category, if set)

### Data Flow

`Task.categoryId` is stored. `Task.categoryColor` is **not** stored directly —
category colours live in the `categories` table. The UI needs the colour at
render time without a separate query per task.

**Solution: denormalise `categoryColor` onto the Task at load time.**

`taskStorage.ts → getAllTasks()` was updated to LEFT JOIN categories:

```sql
SELECT t.*, c.color AS category_color
FROM   tasks t
LEFT JOIN categories c ON c.id = t.category_id
ORDER BY t.created_at DESC
```

`category_color` is NULL when the task has no category or the category has
no colour set. It is mapped to `task.categoryColor ?? undefined`.

`permanentTaskStorage.ts → getAllTemplates()` received the same JOIN so
template rows in `UsePermanentTaskScreen` also carry the colour.
`permanentTaskActions.ts → getAllPermanentTemplates()` passes `categoryColor`
straight through to the returned `Task[]`.

`categoryColor?: string` was added to both the `Task` interface (`task.ts`)
and the `PermanentTask` interface (`permanentTask.ts`).

### Actual Layout — Two Left-Edge Strips ✅

The original plan called for a single category strip. The final implementation
uses **two adjacent strips** so that Pillars 2 and 3 share the same space
without competing:

```
┌──────────────────────────────────────────────────┐
│ ▌▌ [✓] Task title                  [due date] ✕  │
└──────────────────────────────────────────────────┘
  ││
  │└── Category strip  (4 px) — category colour or theme.categoryStripNone
  └─── Permanent strip (3 px) — theme.accentPermanent or transparent
```

The permanent strip (3 px) sits outermost (flush to card edge) with
`borderTopLeftRadius: 8` / `borderBottomLeftRadius: 8` matching the card.
The category strip (4 px) sits immediately to its right with `marginRight: 12`
to gap-separate from the checkbox.

`overflow: 'hidden'` is intentionally **not** used on the container — it clips
drop shadows on iOS. The `borderTopLeftRadius`/`borderBottomLeftRadius` on the
permanent strip achieves the same visual result without clipping the shadow.

The container was changed from `alignItems: 'center'` to `alignItems: 'stretch'`
and from `padding: 16` to `paddingRight: 16, paddingVertical: 0` so the strips
can fill the full card height. Vertical rhythm is restored by `paddingVertical: 16`
on the checkbox and body inner Views.

### Template Rows in UsePermanentTaskScreen ✅

`renderTemplateItem` and `makeStyles` were updated with the same two strips:

```
[ 3px perm strip | 4px cat strip ] [ template name + location + usage count ] [ ⋮ ] [ › ]
```

All template rows are permanent by definition, so the permanent strip is always
purple (`theme.accentPermanent`) there. The category strip shows the template's
assigned category colour, or neutral grey if unassigned.

---

## 3 — Permanent vs One-Off Visual Distinction

### Goal
At a glance the user can tell which tasks are one-off vs recurring (permanent).
Two visual signals:

| Element | One-Off | Permanent |
|---------|---------|-----------|
| Checkbox border + fill | Blue (`#007AFF`) | Purple (`#5856D6`) |
| Type badge (optional) | _(none)_ | Small "↩" or "🔁" text badge next to title |

### Checkbox colour

In `TaskItem`, the checkbox `borderColor` and `backgroundColor` (when checked)
currently hardcode `#007AFF`. Change to:

```typescript
const checkboxColor = task.kind === 'permanent'
  ? theme.checkboxBorderPermanent
  : theme.checkboxBorderOneOff;
```

Apply `checkboxColor` to both `borderColor` (unchecked ring) and
`backgroundColor` (checked fill).

### Recurring badge

Optionally render a small badge to the right of the task title:

```tsx
{task.kind === 'permanent' && (
  <View style={styles.recurringBadge}>
    <Text style={styles.recurringBadgeText}>↩</Text>
  </View>
)}
```

Badge style: small grey pill, `fontSize: 10`, `color: theme.accentPermanent`.
Keeps the card clean — the checkbox colour alone is the primary signal;
the badge is secondary and very small.

Whether to include the badge is a design call — document it as optional here,
implement it if it looks good in practice.

---

## 4 — General Polish

### 4.1 Completed Task Dimming

Currently completed tasks use `line-through` + `color: #999` on the title.
Extend to also dim the entire card slightly:

```typescript
container: [
  styles.containerBase,
  task.completed && { opacity: 0.6 },
]
```

This works nicely in both light and dark mode without a separate dark theme
override. `opacity: 0.6` is enough to read the title while clearly conveying
"done".

### 4.2 Header Consistency

Current state:
- `AllTasksScreen` — blue `#007AFF`, large title, `paddingTop: 60`
- `TodayScreen` — green `#34C759`, large title, `paddingTop: 60`
- `UsePermanentTaskScreen` — white bar, standard iOS nav-bar style
- `HistoryManagementScreen` — purple `#5856D6`, back button, centred title

**Proposed standard for "big" tab headers (AllTasks, Today):**
```
paddingTop: 60  paddingHorizontal: 20  paddingBottom: 16
fontSize: 32 bold white title
fontSize: 16 white subtitle (count)
```
These two screens already match — keep them as-is.

**Proposed standard for "overlay" headers (UseTemplate, History, CreateTask, etc.):**
```
flexDirection: row  justifyContent: space-between
paddingHorizontal: 16  paddingVertical: 12
backgroundColor: theme.bgCard
borderBottom: hairline theme.hairline
```
Consistent across all overlay screens. Currently UseTemplate has a debug
`rgba(0,122,255,0.1)` background on header buttons — **remove this in
implementation** (it was noted as a debug visual in the source).

### 4.3 TodayScreen Filter Tab Bar ✅

A horizontal filter tab bar (matching the style from `HistoryManagementScreen`) was added directly below the green header in `TodayScreen`. The three tabs are:

| Tab | Filter Applied |
|-----|---------------|
| **Today** | `filterTasksDueToday()` — tasks due today (default) |
| **This Week** | `filterTasksDueThisWeek()` — Mon–Sun current week |
| **This Month** | `filterTasksDueThisMonth()` — current calendar month |

The active tab is highlighted with the screen's brand green (`#34C759`). Inactive tabs use `theme.bgInput` / `theme.textSecondary` so they respond to dark mode. The empty message also updates dynamically to match the selected filter (e.g. "No tasks due this week!").

New filter functions `filterTasksDueThisWeek` and `filterTasksDueThisMonth` were added to `app/core/utils/taskFilters.ts` to support this.

### 4.4 Empty State Improvements

Current empty states are plain centred text. Improve:
- Add an icon/emoji above the empty message (AllTasks: `📭`, Today: `☀️`)
- Use `theme.textSecondary` for the message colour
- Keep them simple — no elaborate illustration

### 4.5 BrowseScreen / CategoryManagementScreen

Category list rows in `CategoryManagementScreen` already show a colour dot.
No change needed there — the colour dot is already the category's hex colour.

---

## Files to Create / Modify

### New Files

| File | Purpose | Status |
|------|---------|--------|
| `app/theme/tokens.ts` | Light + dark colour palettes | ✅ Done |
| `app/theme/ThemeContext.tsx` | React context, ThemeProvider, useTheme() | ✅ Done |

### Modified Files — Dark Mode (Pillar 1)

| File | Changes | Status |
|------|---------|--------|
| `App.tsx` | Wrap with `<ThemeProvider>` | ✅ Done |
| `app/screens/browse/BrowseScreen.tsx` | Theme tokens + Dark Mode toggle row (Switch) | ✅ Done |
| `app/components/tasks/TaskItem.tsx` | Theme tokens — bgCard, text, checkbox (kind-aware), delete, completed opacity | ✅ Done |
| `app/components/navigation/TabBar.tsx` | Theme tokens — bg, border, active/inactive label colours | ✅ Done |
| `app/navigation/MainNavigator.tsx` | Theme token for container bg | ✅ Done |
| `app/screens/tasks/AllTasksScreen.tsx` | Theme tokens — bgScreen (header brand colour kept) | ✅ Done |
| `app/screens/today/TodayScreen.tsx` | Theme tokens — bgScreen (header brand colour kept); Day/Week/Month filter tab bar added | ✅ Done |
| `app/screens/stats/StatsScreen.tsx` | Theme tokens — bgScreen, CollapsibleSection card bg + text | ✅ Done |
| `app/screens/browse/HistoryManagementScreen.tsx` | Theme tokens — all surfaces, filter bar, rows | ✅ Done |
| `app/screens/tasks/CreateTaskScreen.tsx` | Theme tokens — all surfaces, inputs, buttons | ✅ Done |
| `app/screens/tasks/CreatePermanentTaskScreen.tsx` | Theme tokens — all surfaces, inputs, switches | ✅ Done |
| `app/screens/tasks/EditPermanentTaskScreen.tsx` | Theme tokens — mirrors CreatePermanentTask | ✅ Done |
| `app/screens/tasks/UsePermanentTaskScreen.tsx` | Theme tokens, debug bg removed from header buttons | ✅ Done |
| `app/screens/stats/detail/OverallDetailScreen.tsx` | bgScreen container | ✅ Done |
| `app/screens/stats/detail/PermanentDetailScreen.tsx` | bgScreen container | ✅ Done |
| `app/screens/stats/detail/CategoryDetailScreen.tsx` | bgScreen container | ✅ Done |

### Shared components — all themed ✅

| File | Status |
|------|--------|
| `app/components/tasks/TaskList.tsx` | ✅ No hardcoded colours (layout only) |
| `app/components/tasks/EditTaskModal.tsx` | ✅ Done |
| `app/components/categories/CategorySelector.tsx` | ✅ Done |
| `app/components/stats/TodayCard.tsx` | ✅ Done |
| `app/components/stats/StatPreviewCard.tsx` | ✅ Done |
| `app/components/stats/WeeklyMiniChart.tsx` | ✅ Done |
| `app/components/stats/detail/shared/CompletionSummaryCard.tsx` | ✅ Done |
| `app/components/stats/detail/shared/StreakCard.tsx` | ✅ Done |
| `app/components/stats/detail/shared/TimeRangePicker.tsx` | ✅ Done |
| `app/components/stats/detail/shared/TaskTypeBreakdownCard.tsx` | ✅ Done |
| `app/components/stats/detail/shared/WeekBarGraph.tsx` | ✅ Done |
| `app/components/stats/detail/shared/DayOfWeekPatternCard.tsx` | ✅ Done |
| `app/components/stats/detail/shared/WeekNavigator.tsx` | ✅ Done |
| `app/components/stats/detail/shared/TimeRangeCountsCard.tsx` | ✅ Done |
| `app/components/stats/detail/shared/MonthCalendarGraph.tsx` | ✅ Done (themed) |
| `app/components/stats/detail/shared/YearOverviewGraph.tsx` | ✅ Done (themed) |
| `app/components/stats/detail/overall/CategoryBreakdownCard.tsx` | ✅ Done |
| `app/components/stats/detail/overall/CategoryWeekBarGraph.tsx` | ✅ Done |
| `app/components/stats/detail/overall/CategoryYearOverviewGraph.tsx` | ✅ Done |
| `app/components/stats/detail/category/PermanentTaskListCard.tsx` | ✅ Done |
| `app/components/stats/detail/shared/DetailHeader.tsx` | ✅ No change needed (brand colour bg + white text) |

### Modified Files — Category Colour Strip (Pillar 2, not started)

| File | Changes | Status |
|------|---------|--------|
| `app/core/types/task.ts` | Add `categoryColor?: string` | ⏳ Planned |
| `app/core/services/storage/taskStorage.ts` | JOIN categories, map `categoryColor` | ⏳ Planned |
| `app/features/permanentTask/utils/permanentTaskActions.ts` | JOIN categories on template load | ⏳ Planned |
| `app/components/tasks/TaskItem.tsx` | 4px left colour strip | ⏳ Planned |
| `app/screens/tasks/UsePermanentTaskScreen.tsx` | 4px left colour strip on template rows | ⏳ Planned |

---

## Implementation Order

### Dark mode — completed steps ✅
1. `app/theme/tokens.ts` — palettes written
2. `app/theme/ThemeContext.tsx` — context with manual toggle + persistence
3. `App.tsx` — wrapped with `<ThemeProvider>`
4. `BrowseScreen.tsx` — Dark Mode toggle row (Switch) + all theme tokens
5. `TaskItem.tsx` — makeStyles, kind-aware checkbox colour, completed opacity
6. `TabBar.tsx` — makeStyles, bg/border/label tokens
7. `MainNavigator.tsx` — container bg token
8. `AllTasksScreen.tsx`, `TodayScreen.tsx` — bgScreen token (brand headers kept)
9. `StatsScreen.tsx` — bgScreen + CollapsibleSection uses useTheme internally
10. `HistoryManagementScreen.tsx` — all surfaces themed
11. `CreateTaskScreen.tsx`, `CreatePermanentTaskScreen.tsx`, `EditPermanentTaskScreen.tsx` — full makeStyles
12. `UsePermanentTaskScreen.tsx` — full makeStyles, debug bg removed
13. `OverallDetailScreen.tsx`, `PermanentDetailScreen.tsx`, `CategoryDetailScreen.tsx` — bgScreen container
14. `EditTaskModal.tsx`, `CategorySelector.tsx`, `TodayCard.tsx`, `StatPreviewCard.tsx`, `WeeklyMiniChart.tsx` — shared task + stats components
15. All `detail/shared/` components — `CompletionSummaryCard`, `StreakCard`, `TimeRangePicker`, `TaskTypeBreakdownCard`, `WeekBarGraph`, `DayOfWeekPatternCard`, `WeekNavigator`, `TimeRangeCountsCard`, `MonthCalendarGraph`, `YearOverviewGraph`
16. All `detail/overall/` components — `CategoryBreakdownCard`, `CategoryWeekBarGraph`, `CategoryYearOverviewGraph`
17. `detail/category/PermanentTaskListCard.tsx`

### Dark mode — remaining ⏳
18. Manual test: toggle Dark Mode in Browse, verify every screen re-skins correctly

### Category colour strips (Pillar 2) — after dark mode is complete
- Add `categoryColor` to Task type + storage JOIN
- Add 4px strip to TaskItem and template rows

---

## Quick Guide — Adding Dark Mode to a Component

Follow these steps every time a new screen or component is built, or when
theming an existing unhemed one.

### Step 1 — Add imports

```tsx
import { useTheme } from '../../theme/ThemeContext';   // adjust path depth
import type { AppTheme } from '../../theme/tokens';    // for makeStyles type
```

Import `useMemo` from React if the component doesn't already use it:
```tsx
import React, { useMemo, ... } from 'react';
```

### Step 2 — Call useTheme() inside the component

```tsx
export const MyComponent: React.FC = () => {
  const { theme } = useTheme();          // read-only palette access
  // If you also need the toggle (e.g. a settings row):
  // const { theme, isDark, toggleTheme } = useTheme();
  ...
};
```

### Step 3 — Convert StyleSheet to makeStyles

Move the `StyleSheet.create({...})` call outside the component into a
`makeStyles` function, and call it inside the component via `useMemo`:

```tsx
// OUTSIDE the component — receives theme, returns StyleSheet
function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: { backgroundColor: theme.bgScreen },
    card:      { backgroundColor: theme.bgCard },
    title:     { color: theme.textPrimary },
    // ...
  });
}

// INSIDE the component
const styles = useMemo(() => makeStyles(theme), [theme]);
```

`useMemo` ensures the StyleSheet is only recreated when the theme changes
(dark/light toggle), not on every render.

### Step 4 — Replace hardcoded colours with tokens

| Hardcoded | Token | When to use |
|-----------|-------|-------------|
| `#f5f5f5` | `theme.bgScreen` | Page / scroll background |
| `#ffffff` | `theme.bgCard` | White card, list row, modal surface |
| `#f5f5f5` (modal bg) | `theme.bgModal` | Bottom sheet / modal background |
| `#f0f0f0` | `theme.bgInput` | Text input, inactive pill button |
| `#ffffff` (form section) | `theme.bgSection` | Form section card |
| `#000000` | `theme.textPrimary` | Main body text |
| `#666666` | `theme.textSecondary` | Labels, captions |
| `#888888` | `theme.textTertiary` | Helper text, placeholders |
| `#bbbbbb` | `theme.textDisabled` | placeholderTextColor |
| `#007AFF` | `theme.accent` | Buttons, active states, links |
| `#FF3B30` | `theme.danger` | Delete buttons |
| `#dddddd` | `theme.border` | Input borders, dividers |
| `#f0f0f0` | `theme.separator` | Section separators |
| `#cccccc` | `theme.hairline` | Chevrons, hairline borders |

**Brand header colours stay hardcoded** — `#007AFF`, `#34C759`, `#FF9500`,
`#5856D6` are identity colours that don't change in dark mode.

### Step 5 — Inline dynamic colours (when StyleSheet isn't enough)

For colours that depend on runtime data (e.g. category colour, task kind),
use inline styles:

```tsx
// Checkbox colour varies by task kind
const checkboxColor = task.kind === 'permanent'
  ? theme.checkboxBorderPermanent
  : theme.checkboxBorderOneOff;

<View style={{ borderColor: checkboxColor, ... }} />
```

### Complete example (minimal screen)

```tsx
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import type { AppTheme } from '../../theme/tokens';

export const ExampleScreen: React.FC = () => {
  const { theme } = useTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Hello</Text>
      </View>
    </SafeAreaView>
  );
};

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.bgScreen },
    card:      { backgroundColor: theme.bgCard, borderRadius: 12, padding: 16, margin: 16 },
    title:     { fontSize: 18, color: theme.textPrimary },
  });
}
```

---

## Design Decisions / Open Questions

| Question | Proposed Answer |
|----------|----------------|
| Should the colour strip appear on completed tasks? | Yes — keeps layout stable; opacity dimming on the whole card handles the "done" signal |
| Recurring badge next to title — include? | Start without; add later if it looks cluttered to distinguish only by checkbox colour |
| Should permanent task templates show a category strip? | Yes — templates in UsePermanentTaskScreen are the primary place users associate recurring tasks with categories |
| Dark mode: keep brand header colours (blue/green/orange/purple)? | Yes — they are brand-identity colours, not semantic surfaces |
| `useColorScheme()` — follow system setting only, or allow manual override? | ~~Follow system only for now~~ **Changed**: manual toggle in BrowseScreen, persisted to `app_settings`. System colour scheme is still the default on first launch. |
