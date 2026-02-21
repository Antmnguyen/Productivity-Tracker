// app/screens/stats/detail/CategoryDetailScreen.tsx
// =============================================================================
// CATEGORY DETAIL SCREEN
// =============================================================================
//
// Full-screen detail view for a single task category (e.g. Work, Health).
// Opened when the user taps a Category StatPreviewCard in StatsScreen.
//
// ── Layout (top to bottom) ────────────────────────────────────────────────────
//
//   DetailHeader          ← category accent color, category name, back arrow
//   CompletionSummaryCard ← ring + total completed + rate %
//   StreakCard            ← current streak + best streak pills
//   TimeRangeCountsCard   ← Week / Month / Year / All Time counts
//   WeekBarGraph          ← segmented bars (permanent green / one-off blue)
//   MonthCalendarGraph    ← current month calendar
//   YearOverviewGraph     ← 12-bar Jan–Dec, segmented bars
//   DayOfWeekPatternCard  ← all-time by weekday, segmented bars
//   TaskTypeBreakdownCard ← permanent vs one-off split within this category
//   PermanentTaskListCard ← tappable list of permanent templates in this category
//
// ── Data ─────────────────────────────────────────────────────────────────────
//
//   Uses getMockCategoryDetail(id) — replace with useStats().getCategoryDetail(id)
//   when the storage layer is ready (Phase 6).
//   Output varies by params.id (e.g. 'cat_work', 'cat_health').
//
// ── Navigation from PermanentTaskListCard ─────────────────────────────────────
//
//   Tapping a task row calls onStatCardPress({ type: 'template', ... }) which
//   MainNavigator handles to open PermanentDetailScreen for that task.
//
// =============================================================================

import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

// ── Shared detail components ─────────────────────────────────────────────────
import { DetailHeader }          from '../../../components/stats/detail/shared/DetailHeader';
import { CompletionSummaryCard } from '../../../components/stats/detail/shared/CompletionSummaryCard';
import { StreakCard }            from '../../../components/stats/detail/shared/StreakCard';
import { TimeRangeCountsCard, TimeRangeBreakdown } from '../../../components/stats/detail/shared/TimeRangeCountsCard';
import { WeekBarGraph }          from '../../../components/stats/detail/shared/WeekBarGraph';
import { MonthCalendarGraph, CalendarDayData } from '../../../components/stats/detail/shared/MonthCalendarGraph';
import { YearOverviewGraph, MonthData }        from '../../../components/stats/detail/shared/YearOverviewGraph';
import { DayOfWeekPatternCard, DayOfWeekData } from '../../../components/stats/detail/shared/DayOfWeekPatternCard';
import { TaskTypeBreakdownCard } from '../../../components/stats/detail/shared/TaskTypeBreakdownCard';

// ── Category-specific components ──────────────────────────────────────────────
import { PermanentTaskListCard, PermanentTaskStat } from '../../../components/stats/detail/category/PermanentTaskListCard';

// ── Types ─────────────────────────────────────────────────────────────────────
import { StatDetailParams } from '../../../core/types/statDetailTypes';
import { DayData } from '../../../components/stats/WeeklyMiniChart';

// =============================================================================
// TYPES
// =============================================================================

interface CategoryDetailScreenProps {
  params:           StatDetailParams;
  onBack:           () => void;
  /** Re-uses MainNavigator's handleStatCardPress to open PermanentDetailScreen */
  onStatCardPress:  (p: StatDetailParams) => void;
}

// =============================================================================
// MOCK DATA
// =============================================================================
//
// Replace getMockCategoryDetail() with a real storage hook in Phase 6.
//

interface CategoryDetailMockData {
  completed:       number;
  total:           number;
  currentStreak:   number;
  bestStreak:      number;
  weekCount:       number;
  monthCount:      number;
  yearCount:       number;
  allTimeCount:    number;
  weeklyData:      DayData[];
  monthlyData:     CalendarDayData[];
  yearlyData:      MonthData[];
  dayOfWeekData:   DayOfWeekData[];
  permanentCount:  number;
  oneOffCount:     number;
  breakdown:       TimeRangeBreakdown;
  permanentTasks:  PermanentTaskStat[];
}

/** Stable 0–9 numeric offset derived from the id string. */
function idOffset(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash + id.charCodeAt(i)) % 10;
  return hash;
}

/** Builds realistic mock data for a category. */
function getMockCategoryDetail(id: string): CategoryDetailMockData {
  const o = idOffset(id); // 0–9

  // ── Completion summary ──────────────────────────────────────────────────────
  const total     = 80 + o * 10;
  const completed = Math.round(total * (0.68 + o * 0.02));

  // ── Task type split ─────────────────────────────────────────────────────────
  const permanentCount = Math.round(completed * (0.60 + o * 0.03));
  const oneOffCount    = completed - permanentCount;

  // ── Streaks ─────────────────────────────────────────────────────────────────
  const currentStreak = 3 + o * 2;
  const bestStreak    = 14 + o * 4;

  // ── Time range counts with perm/one-off breakdown ───────────────────────────
  const pFrac        = permanentCount / completed;
  const weekCount    = 5 + o;
  const monthCount   = 22 + o * 3;
  const yearCount    = completed;
  const allTimeCount = completed + 40 + o * 15;

  const breakdown: TimeRangeBreakdown = {
    week:    { perm: Math.round(weekCount * pFrac),    oneOff: weekCount - Math.round(weekCount * pFrac) },
    month:   { perm: Math.round(monthCount * pFrac),   oneOff: monthCount - Math.round(monthCount * pFrac) },
    year:    { perm: permanentCount,                   oneOff: oneOffCount },
    allTime: { perm: Math.round(allTimeCount * pFrac), oneOff: allTimeCount - Math.round(allTimeCount * pFrac) },
  };

  // ── Weekly bar chart (Mon–Sun) with perm/one-off segments ──────────────────
  const weekDays   = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const weekBases  = [6, 5, 4, 6, 4, 2, 1];
  const weekTotals = [8, 8, 7, 8, 7, 4, 2];

  const weeklyData: DayData[] = weekDays.map((day, i) => {
    const cnt       = Math.min(weekBases[i] + (o % 3), weekTotals[i]);
    const permCnt   = Math.round(cnt * 0.65);
    const oneOffCnt = cnt - permCnt;
    return {
      day,
      count:    cnt,
      total:    weekTotals[i],
      segments: cnt > 0 ? [
        { label: 'Permanent', color: '#34C759', count: permCnt },
        { label: 'One-off',   color: '#007AFF', count: oneOffCnt },
      ] : undefined,
    };
  });

  // ── Monthly calendar (current month) ───────────────────────────────────────
  const now       = new Date();
  const todayDate = now.getDate();
  const monthlyData: CalendarDayData[] = [];

  // Cycle completed 1–5 so count mode (relative to max day) and % mode
  // (relative to fixed total=7) land in different ring tiers.
  // e.g. completed=5 → count 5/5=100% (4 sides) vs % 5/7=71% (3 sides).
  //      completed=2 → count 2/5=40%  (2 sides) vs % 2/7=29% (2 sides — tie).
  //      completed=4 → count 4/5=80%  (4 sides) vs % 4/7=57% (3 sides).
  const calTotal = 7;
  for (let d = 1; d <= todayDate; d++) {
    const completed = ((d * 2 + o) % 5) + 1; // 1–5
    monthlyData.push({ date: d, completed, total: calTotal });
  }

  // ── Yearly bar chart (Jan–Dec) with perm/one-off segments ──────────────────
  const currentMonth = now.getMonth();

  const yearlyData: MonthData[] = Array.from({ length: 12 }, (_, m) => {
    if (m > currentMonth) return { month: m, completed: 0, total: 0 };
    const base      = 14 + m * 2 + o;
    const comp      = Math.min(base, 28);
    const permComp  = Math.round(comp * 0.68);
    const oneOffComp = comp - permComp;
    return {
      month:     m,
      completed: comp,
      total:     30,
      segments: [
        { label: 'Permanent', color: '#34C759', count: permComp },
        { label: 'One-off',   color: '#007AFF', count: oneOffComp },
      ],
    };
  });

  // ── Day-of-week pattern (all-time totals by weekday) with segments ──────────
  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const dayBases  = [20, 18, 16, 19, 15, 8, 4];
  const dayTotals = [24, 24, 24, 24, 22, 12, 6];

  const dayOfWeekData: DayOfWeekData[] = dayLabels.map((day, i) => {
    const cnt       = Math.min(dayBases[i] + ((o * (i + 1)) % 5), dayTotals[i]);
    const permCnt   = Math.round(cnt * 0.65);
    const oneOffCnt = cnt - permCnt;
    return {
      day,
      count:    cnt,
      total:    dayTotals[i],
      segments: cnt > 0 ? [
        { label: 'Permanent', color: '#34C759', count: permCnt },
        { label: 'One-off',   color: '#007AFF', count: oneOffCnt },
      ] : undefined,
    };
  });

  // ── Permanent task list for this category ───────────────────────────────────
  const permanentTasks: PermanentTaskStat[] = [
    {
      id:             `${id}_task1`,
      name:           'Morning Standup',
      completed:      40 + o,
      total:          50,
      completionRate: Math.min(80 + o, 99),
    },
    {
      id:             `${id}_task2`,
      name:           'Weekly Review',
      completed:      30 + o,
      total:          50,
      completionRate: Math.min(60 + o, 99),
    },
    {
      id:             `${id}_task3`,
      name:           'Code Review',
      completed:      25 + o,
      total:          50,
      completionRate: Math.min(50 + o, 99),
    },
  ];

  return {
    completed,
    total,
    permanentCount,
    oneOffCount,
    breakdown,
    currentStreak,
    bestStreak,
    weekCount,
    monthCount,
    yearCount,
    allTimeCount,
    weeklyData,
    monthlyData,
    yearlyData,
    dayOfWeekData,
    permanentTasks,
  };
}

// =============================================================================
// COMPONENT
// =============================================================================

export const CategoryDetailScreen: React.FC<CategoryDetailScreenProps> = ({
  params,
  onBack,
  onStatCardPress,
}) => {
  const data = getMockCategoryDetail(params.id);
  const now  = new Date();

  /** Called by PermanentTaskListCard when a task row is tapped. */
  const handleTaskPress = (id: string, name: string, color: string) => {
    onStatCardPress({ type: 'template', id, name, color });
  };

  return (
    <View style={styles.container}>

      {/* ── Fixed header ────────────────────────────────────────────────── */}
      <DetailHeader
        title={params.name}
        color={params.color}
        onBack={onBack}
      />

      {/* ── Scrollable body ─────────────────────────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* 1. Large ring + completed count + rate % */}
        <CompletionSummaryCard
          completed={data.completed}
          total={data.total}
          color={params.color}
        />

        {/* 2. Current streak + best streak */}
        <StreakCard
          currentStreak={data.currentStreak}
          bestStreak={data.bestStreak}
          color={params.color}
        />

        {/* 3. Permanent vs one-off split within this category */}
        <TaskTypeBreakdownCard
          permanentCount={data.permanentCount}
          oneOffCount={data.oneOffCount}
          color={params.color}
        />

        {/* 4. Week / Month / Year / All Time counts with perm/one-off breakdown */}
        <TimeRangeCountsCard
          weekCount={data.weekCount}
          monthCount={data.monthCount}
          yearCount={data.yearCount}
          allTimeCount={data.allTimeCount}
          color={params.color}
          breakdown={data.breakdown}
        />

        {/* 5. 7-bar week chart — segmented perm (green) + one-off (blue) */}
        <WeekBarGraph
          data={data.weeklyData}
          color={params.color}
        />

        {/* 6. Calendar grid for the current month */}
        <MonthCalendarGraph
          year={now.getFullYear()}
          month={now.getMonth()}
          data={data.monthlyData}
          color={params.color}
        />

        {/* 7. 12-bar year overview — segmented bars */}
        <YearOverviewGraph
          data={data.yearlyData}
          color={params.color}
        />

        {/* 8. All-time completions by weekday — segmented bars */}
        <DayOfWeekPatternCard
          data={data.dayOfWeekData}
          color={params.color}
        />

        {/* 9. Tappable list of permanent tasks — drills into PermanentDetailScreen */}
        <PermanentTaskListCard
          tasks={data.permanentTasks}
          color={params.color}
          onTaskPress={handleTaskPress}
        />

        <View style={styles.bottomPad} />

      </ScrollView>
    </View>
  );
};

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: '#f5f5f5',
  },

  scroll: {
    flex: 1,
  },

  scrollContent: {
    paddingTop: 16,
  },

  bottomPad: {
    height: 40,
  },
});
