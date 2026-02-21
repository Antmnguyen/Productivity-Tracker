// app/components/stats/detail/overall/CategoryWeekBarGraph.tsx
// =============================================================================
// CATEGORY WEEK BAR GRAPH
// =============================================================================
//
// 7-bar chart (Mon–Sun) where each bar is stacked and coloured by category.
// No % toggle — bars always show raw completion counts.
//
// Visual layout:
//
//   WEEK BY CATEGORY
//   ┌──────────────────────────────────────────────────────┐
//   │   ‹     Feb 10 – Feb 16, 2026     ›                 │
//   └──────────────────────────────────────────────────────┘
//
//   ██  █  ▄  ██  ▄   _   _        ← bars coloured by category
//   M   T  W   T  F   S   S
//   10  6  4   9  3   0   0        ← total count
//
//   ● Work  ● Health  ● Lifestyle  ← colour legend
//
// Navigation: same ‹ / › week nav as WeekBarGraph.
//   - Past weeks show seeded solid bars (no category breakdown available).
//   - Current week shows full stacked category segments.
//
// Used by:
//   OverallDetailScreen
//
// =============================================================================

import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

// =============================================================================
// TYPES
// =============================================================================

export interface CategorySegment {
  name:  string;  // e.g. 'Work'
  color: string;  // category hex color, e.g. '#5856D6'
  count: number;  // completions in this category for this bar
}

export interface CategoryDayData {
  day:      string;             // single-character day label: 'M' 'T' etc.
  segments: CategorySegment[];  // ordered list — first segment sits at bottom
}

interface CategoryWeekBarGraphProps {
  /** Exactly 7 CategoryDayData items ordered Mon → Sun */
  data:              CategoryDayData[];
  /** Hex accent color used for section label, nav arrows, and past-week bars */
  color:             string;
  /** Optional Monday Date to open on; defaults to this week's Monday */
  initialWeekStart?: Date;
  /** Fired when the user navigates to a different week */
  onWeekChange?:     (weekStart: Date) => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const BAR_MAX_HEIGHT = 80;
const BAR_MIN_HEIGHT = 4;
const BAR_WIDTH      = 28;

const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// =============================================================================
// HELPERS
// =============================================================================

function getMondayOf(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = Sun
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d;
}

function formatWeekLabel(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const sm = MONTHS_SHORT[monday.getMonth()];
  const em = MONTHS_SHORT[sunday.getMonth()];
  return `${sm} ${monday.getDate()} – ${em} ${sunday.getDate()}, ${sunday.getFullYear()}`;
}

function seededRand(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

// =============================================================================
// SUB-COMPONENT — single bar column
// =============================================================================

interface BarColumnProps {
  day:      string;
  /** Present for the current week; null for past weeks (solid bar instead) */
  segments: CategorySegment[] | null;
  /** Pre-computed total count (sum of segments, or seeded value for past weeks) */
  total:    number;
  maxTotal: number;
  /** Accent color — used for past-week solid bars and the value label */
  color:    string;
}

const BarColumn: React.FC<BarColumnProps> = ({ day, segments, total, maxTotal, color }) => {
  const hasActivity = total > 0;

  return (
    <View style={col.container}>
      <View style={[col.barArea, { height: BAR_MAX_HEIGHT }]}>
        {segments ? (
          // Current week — stacked category segments, bottom-anchored via parent flex-end
          <View style={{ width: BAR_WIDTH, overflow: 'hidden', borderRadius: 5 }}>
            {[...segments].reverse().map((seg, i) => {
              const h = Math.max((seg.count / maxTotal) * BAR_MAX_HEIGHT, 0);
              return <View key={i} style={{ height: h, backgroundColor: seg.color }} />;
            })}
          </View>
        ) : (
          // Past week — single solid bar
          <View
            style={{
              width:           BAR_WIDTH,
              height:          hasActivity
                ? Math.max((total / maxTotal) * BAR_MAX_HEIGHT, BAR_MIN_HEIGHT)
                : BAR_MIN_HEIGHT,
              borderRadius:    5,
              backgroundColor: hasActivity ? color : '#e8e8e8',
            }}
          />
        )}
      </View>
      <Text style={col.dayLabel}>{day}</Text>
      <Text style={[col.valueLabel, hasActivity && { color }]}>{total}</Text>
    </View>
  );
};

const col = StyleSheet.create({
  container:  { alignItems: 'center', flex: 1 },
  barArea:    { justifyContent: 'flex-end', alignItems: 'center' },
  dayLabel:   { fontSize: 12, color: '#aaa', fontWeight: '600', marginTop: 6 },
  valueLabel: { fontSize: 11, color: '#ccc', fontWeight: '500', marginTop: 2 },
});

// =============================================================================
// COMPONENT
// =============================================================================

export const CategoryWeekBarGraph: React.FC<CategoryWeekBarGraphProps> = ({
  data,
  color,
  initialWeekStart,
  onWeekChange,
}) => {
  const [weekStart, setWeekStart] = useState<Date>(
    () => initialWeekStart ? getMondayOf(initialWeekStart) : getMondayOf(new Date()),
  );

  const currentMonday  = useMemo(() => getMondayOf(new Date()), []);
  const isCurrentWeek  = weekStart.getTime() === currentMonday.getTime();
  const weekSeed       = Math.floor(weekStart.getTime() / (7 * 24 * 3600 * 1000));

  // Build display items — current week preserves segments, past weeks use seeded totals
  const displayItems = useMemo(() => {
    if (isCurrentWeek) {
      return data.map(d => ({
        day:      d.day,
        segments: d.segments,
        total:    d.segments.reduce((s, seg) => s + seg.count, 0),
      }));
    }
    return data.map((d, i) => {
      const baseTotal = d.segments.reduce((s, seg) => s + seg.count, 0);
      const total     = Math.round(seededRand(weekSeed * 10 + i) * Math.max(baseTotal, 3));
      return { day: d.day, segments: null as CategorySegment[] | null, total };
    });
  }, [weekStart, data, isCurrentWeek, weekSeed]);

  const maxTotal = Math.max(...displayItems.map(d => d.total), 1);

  const handlePrev = () => {
    const prev = new Date(weekStart);
    prev.setDate(prev.getDate() - 7);
    setWeekStart(prev);
    onWeekChange?.(prev);
  };

  const handleNext = () => {
    if (isCurrentWeek) return;
    const next = new Date(weekStart);
    next.setDate(next.getDate() + 7);
    setWeekStart(next);
    onWeekChange?.(next);
  };

  // Legend always derived from the prop data so it stays stable across navigation
  const legend = data[0]?.segments ?? [];

  return (
    <View style={styles.card}>

      {/* ── Section label ─────────────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>WEEK BY CATEGORY</Text>

      {/* ── Week navigator ────────────────────────────────────────────────── */}
      <View style={styles.navRow}>
        <TouchableOpacity
          onPress={handlePrev}
          style={styles.navArrow}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={0.6}
        >
          <Text style={styles.navArrowText}>‹</Text>
        </TouchableOpacity>

        <Text style={styles.navLabel}>{formatWeekLabel(weekStart)}</Text>

        <TouchableOpacity
          onPress={handleNext}
          style={[styles.navArrow, isCurrentWeek && styles.navArrowDisabled]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          activeOpacity={isCurrentWeek ? 1 : 0.6}
          disabled={isCurrentWeek}
        >
          <Text style={[styles.navArrowText, isCurrentWeek && styles.navArrowTextDisabled]}>›</Text>
        </TouchableOpacity>
      </View>

      {/* ── 7 bar columns ─────────────────────────────────────────────────── */}
      <View style={styles.barsRow}>
        {displayItems.map((item, i) => (
          <BarColumn
            key={i}
            day={item.day}
            segments={item.segments}
            total={item.total}
            maxTotal={maxTotal}
            color={color}
          />
        ))}
      </View>

      {/* ── Category legend ───────────────────────────────────────────────── */}
      {legend.length > 0 && (
        <View style={styles.legend}>
          {legend.map(seg => (
            <View key={seg.name} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: seg.color }]} />
              <Text style={styles.legendLabel}>{seg.name}</Text>
            </View>
          ))}
        </View>
      )}

    </View>
  );
};

// =============================================================================
// STYLES
// =============================================================================

const styles = StyleSheet.create({
  card: {
    backgroundColor:  '#fff',
    borderRadius:     18,
    marginHorizontal: 16,
    marginBottom:     12,
    padding:          20,
    shadowColor:      '#000',
    shadowOffset:     { width: 0, height: 2 },
    shadowOpacity:    0.07,
    shadowRadius:     8,
    elevation:        3,
  },

  sectionLabel: {
    fontSize:      11,
    fontWeight:    '800',
    color:         '#ccc',
    letterSpacing: 1.1,
    marginBottom:  10,
  },

  navRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    backgroundColor:   '#fafafa',
    borderRadius:      12,
    borderWidth:       1,
    borderColor:       '#f0f0f0',
    paddingVertical:   8,
    paddingHorizontal: 12,
    marginBottom:      14,
  },

  navArrow: {
    padding: 2,
  },
  navArrowDisabled: {
    opacity: 0.25,
  },
  navArrowText: {
    fontSize:   24,
    color:      '#555',
    fontWeight: '400',
    lineHeight: 28,
  },
  navArrowTextDisabled: {
    color: '#bbb',
  },
  navLabel: {
    flex:       1,
    textAlign:  'center',
    fontSize:   13,
    fontWeight: '600',
    color:      '#333',
  },

  barsRow: {
    flexDirection: 'row',
    alignItems:    'flex-end',
  },

  legend: {
    flexDirection:  'row',
    flexWrap:       'wrap',
    gap:            10,
    marginTop:      14,
    paddingTop:     12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           5,
  },
  legendDot: {
    width:        8,
    height:       8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize:   12,
    color:      '#666',
    fontWeight: '500',
  },
});
