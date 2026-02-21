// app/screens/stats/detail/OverallDetailScreen.tsx
// =============================================================================
// OVERALL DETAIL SCREEN
// =============================================================================
//
// Full-screen detail view for an overall stats bucket (All Time / This Year /
// This Month / This Week). Opened when the user taps an overall StatPreviewCard
// in StatsScreen.
//
// ── Layout (top to bottom) ────────────────────────────────────────────────────
//
//   DetailHeader          ← orange accent, bucket name, back arrow
//   CompletionSummaryCard ← ring + total completed + rate %
//   StreakCard            ← current streak + best streak pills
//   TimeRangeCountsCard   ← Week / Month / Year / All Time counts
//   WeekBarGraph          ← segmented bars (permanent green / one-off blue)
//   MonthCalendarGraph    ← current month calendar
//   YearOverviewGraph     ← 12-bar Jan–Dec, segmented bars
//   DayOfWeekPatternCard  ← all-time by weekday, segmented bars
//   TaskTypeBreakdownCard ← permanent vs one-off split
//   CategoryBreakdownCard ← top 5 categories horizontal bar list
//
// ── Data ─────────────────────────────────────────────────────────────────────
//
//   Uses getMockOverallDetail(id) — replace with useStats().getOverallDetail(id)
//   when the storage layer is ready (Phase 6).
//   Output varies by params.id so each overall card (all_time / all_year /
//   all_month / all_week) shows distinct, stable data.
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

// ── Overall-specific components ───────────────────────────────────────────────
import { CategoryBreakdownCard, CategoryBreakdownItem } from '../../../components/stats/detail/overall/CategoryBreakdownCard';
import { CategoryWeekBarGraph, CategoryDayData }        from '../../../components/stats/detail/overall/CategoryWeekBarGraph';
import { CategoryYearOverviewGraph, CategoryMonthData } from '../../../components/stats/detail/overall/CategoryYearOverviewGraph';

// ── Types ─────────────────────────────────────────────────────────────────────
import { StatDetailParams } from '../../../core/types/statDetailTypes';
import { DayData } from '../../../components/stats/WeeklyMiniChart';

// =============================================================================
// TYPES
// =============================================================================

interface OverallDetailScreenProps {
  params: StatDetailParams;
  onBack: () => void;
}

// =============================================================================
// MOCK DATA
// =============================================================================
//
// Replace getMockOverallDetail() with a real storage hook in Phase 6.
//
// Varies output by params.id so all_time / all_year / all_month / all_week
// each produce meaningfully different numbers.
//

interface OverallDetailMockData {
  completed:            number;
  total:                number;
  currentStreak:        number;
  bestStreak:           number;
  weekCount:            number;
  monthCount:           number;
  yearCount:            number;
  allTimeCount:         number;
  weeklyData:           DayData[];
  monthlyData:          CalendarDayData[];
  yearlyData:           MonthData[];
  dayOfWeekData:        DayOfWeekData[];
  permanentCount:       number;
  oneOffCount:          number;
  breakdown:            TimeRangeBreakdown;
  categories:           CategoryBreakdownItem[];
  categoryWeeklyData:   CategoryDayData[];
  categoryYearlyData:   CategoryMonthData[];
}

/** Stable 0–9 numeric offset derived from the id string. */
function idOffset(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash + id.charCodeAt(i)) % 10;
  return hash;
}

type OverallBucket = 'week' | 'month' | 'year' | 'all_time';

function getBucket(id: string): OverallBucket {
  if (id === 'all_week')  return 'week';
  if (id === 'all_month') return 'month';
  if (id === 'all_year')  return 'year';
  return 'all_time';
}

/** Builds realistic mock data for an overall stats bucket. */
function getMockOverallDetail(id: string): OverallDetailMockData {
  const o = idOffset(id); // 0–9

  // ── Completion summary ──────────────────────────────────────────────────────
  const total     = 200 + o * 20;
  const completed = Math.round(total * (0.70 + o * 0.02));

  // ── Task type split ─────────────────────────────────────────────────────────
  const permanentCount = Math.round(completed * (0.55 + o * 0.03));
  const oneOffCount    = completed - permanentCount;

  // ── Streaks (scoped to bucket) ───────────────────────────────────────────────
  const bucket = getBucket(id);
  const currentStreak = bucket === 'week'  ? Math.min(2 + o, 7)
                      : bucket === 'month' ? Math.min(5 + o * 2, 28)
                      : bucket === 'year'  ? 8 + o * 3
                      : /* all_time */       5 + o * 2;
  const bestStreak    = bucket === 'week'  ? Math.min(3 + o, 7)
                      : bucket === 'month' ? Math.min(8 + o * 2, 28)
                      : bucket === 'year'  ? 20 + o * 4
                      : /* all_time */       20 + o * 5;

  // ── Time range counts with perm/one-off breakdown ───────────────────────────
  const pFrac        = permanentCount / completed; // overall perm fraction
  const weekCount    = 10 + o * 2;
  const monthCount   = 48 + o * 5;
  const yearCount    = completed;
  const allTimeCount = completed + 100 + o * 30;

  const breakdown: TimeRangeBreakdown = {
    week:    { perm: Math.round(weekCount * pFrac),    oneOff: weekCount - Math.round(weekCount * pFrac) },
    month:   { perm: Math.round(monthCount * pFrac),   oneOff: monthCount - Math.round(monthCount * pFrac) },
    year:    { perm: permanentCount,                   oneOff: oneOffCount },
    allTime: { perm: Math.round(allTimeCount * pFrac), oneOff: allTimeCount - Math.round(allTimeCount * pFrac) },
  };

  // ── Weekly bar chart (Mon–Sun) with perm/one-off segments ──────────────────
  const weekDays   = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const weekBases  = [12, 10,  8, 11,  9,  5,  3];
  const weekTotals = [15, 15, 14, 15, 13,  8,  5];

  const weeklyData: DayData[] = weekDays.map((day, i) => {
    const cnt       = Math.min(weekBases[i] + (o % 4), weekTotals[i]);
    const permCnt   = Math.round(cnt * 0.6);
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

  // Cycle completed 2–9 across days so count mode (relative to busiest day)
  // and % mode (relative to fixed total) land in different ring tiers.
  // e.g. completed=9 → count 9/9=100% (4 sides) vs % 9/12=75% (3 sides).
  //      completed=5 → count 5/9=56%  (3 sides) vs % 5/12=42% (2 sides).
  const calTotal = 12;
  for (let d = 1; d <= todayDate; d++) {
    const completed = ((d * 3 + o * 2) % 8) + 2; // 2–9
    monthlyData.push({ date: d, completed, total: calTotal });
  }

  // ── Yearly bar chart (Jan–Dec) with perm/one-off segments ──────────────────
  const currentMonth = now.getMonth();

  const yearlyData: MonthData[] = Array.from({ length: 12 }, (_, m) => {
    if (m > currentMonth) return { month: m, completed: 0, total: 0 };
    const base      = 30 + m * 3 + o * 2;
    const comp      = Math.min(base, 58);
    const permComp  = Math.round(comp * 0.65);
    const oneOffComp = comp - permComp;
    return {
      month:     m,
      completed: comp,
      total:     65,
      segments: [
        { label: 'Permanent', color: '#34C759', count: permComp },
        { label: 'One-off',   color: '#007AFF', count: oneOffComp },
      ],
    };
  });

  // ── Day-of-week pattern with segments ───────────────────────────────────────
  // Real backend will pre-filter records to the bucket's time window before
  // aggregating by weekday — no client-side time logic needed here.
  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const dayBases  = [42, 38, 35, 40, 33, 18, 10];
  const dayTotals = [50, 50, 50, 50, 48, 25, 15];

  const dayOfWeekData: DayOfWeekData[] = dayLabels.map((day, i) => {
    const cnt       = Math.min(dayBases[i] + ((o * (i + 1)) % 8), dayTotals[i]);
    const permCnt   = Math.round(cnt * 0.62);
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

  // ── Category breakdown (top 5 by completions) ───────────────────────────────
  const categories: CategoryBreakdownItem[] = [
    { name: 'Work',      color: '#5856D6', count: 64 + o * 3, percent: 85 - o },
    { name: 'Health',    color: '#FF2D55', count: 38 + o * 2, percent: 70 + o },
    { name: 'Lifestyle', color: '#FF9500', count: 31 + o,     percent: 65 + o },
    { name: 'Learning',  color: '#34C759', count: 22 + o,     percent: 58 + o },
    { name: 'Personal',  color: '#007AFF', count: 15 + o,     percent: 50 + o },
  ];

  // ── Category-segmented week bars ─────────────────────────────────────────────
  // Distribute each day's total count across the 5 categories proportionally.
  const catFracs = [0.35, 0.22, 0.18, 0.13, 0.12]; // must sum to 1

  const categoryWeeklyData: CategoryDayData[] = weekDays.map((day, i) => {
    const cnt = Math.min(weekBases[i] + (o % 4), weekTotals[i]);
    let remaining = cnt;
    const segments = categories.map((cat, ci) => {
      if (ci === categories.length - 1) {
        return { name: cat.name, color: cat.color, count: Math.max(remaining, 0) };
      }
      const count = Math.round(cnt * catFracs[ci]);
      remaining  -= count;
      return { name: cat.name, color: cat.color, count };
    });
    return { day, segments };
  });

  // ── Category-segmented year bars ─────────────────────────────────────────────
  const categoryYearlyData: CategoryMonthData[] = Array.from({ length: 12 }, (_, m) => {
    if (m > currentMonth) return { month: m, segments: [] };
    const base = 30 + m * 3 + o * 2;
    const comp = Math.min(base, 58);
    let remaining = comp;
    const segments = categories.map((cat, ci) => {
      if (ci === categories.length - 1) {
        return { name: cat.name, color: cat.color, count: Math.max(remaining, 0) };
      }
      const count = Math.round(comp * catFracs[ci]);
      remaining  -= count;
      return { name: cat.name, color: cat.color, count };
    });
    return { month: m, segments };
  });

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
    categories,
    categoryWeeklyData,
    categoryYearlyData,
  };
}

// =============================================================================
// COMPONENT
// =============================================================================

export const OverallDetailScreen: React.FC<OverallDetailScreenProps> = ({
  params,
  onBack,
}) => {
  const data             = getMockOverallDetail(params.id);
  const now              = new Date();
  const bucket           = getBucket(params.id);
  const showMonth        = bucket !== 'week';
  const showYear         = bucket === 'year' || bucket === 'all_time';
  const showDayOfWeek    = bucket !== 'week';
  const showCategoryYear = bucket === 'year' || bucket === 'all_time';

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

        {/* 3. Permanent vs one-off split */}
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
        {showMonth && (
          <MonthCalendarGraph
            year={now.getFullYear()}
            month={now.getMonth()}
            data={data.monthlyData}
            color={params.color}
          />
        )}

        {/* 7. 12-bar year overview — segmented bars */}
        {showYear && (
          <YearOverviewGraph
            data={data.yearlyData}
            color={params.color}
          />
        )}

        {/* 8. All-time completions by weekday — segmented bars */}
        {showDayOfWeek && (
          <DayOfWeekPatternCard
            data={data.dayOfWeekData}
            color={params.color}
          />
        )}

        {/* 9. Top 5 categories horizontal bar list */}
        <CategoryBreakdownCard
          categories={data.categories}
          color={params.color}
        />

        {/* 10. Weekly completions stacked by category color */}
        <CategoryWeekBarGraph
          data={data.categoryWeeklyData}
          color={params.color}
        />

        {/* 11. Year overview stacked by category color */}
        {showCategoryYear && (
          <CategoryYearOverviewGraph
            data={data.categoryYearlyData}
            color={params.color}
          />
        )}

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
