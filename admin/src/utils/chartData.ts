// Data shaping for the dashboard charts (components/charts.tsx).

export type Series = { key: string; label: string; values: number[] };

// The validated categorical order (blue, orange, aqua — checked for color
// blindness), always used in this order.
export const SERIES_COLORS = ['#2a78d6', '#eb6834', '#1baf7a'];

export const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const hourLabel = (h: number) => `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`;

/** Rows for a time chart's table: one per bucket, one column per series. */
export function seriesTable(labels: string[], series: Series[]) {
  return {
    columns: ['When', ...series.map((s) => s.label)],
    rows: labels.map((label, i) => [label, ...series.map((s) => s.values[i] ?? 0)]),
  };
}

/** The busiest-hours grid as a table: a row per day, a column per hour. */
export const heatmapTable = (grid: number[][]) => ({
  columns: ['Day', ...Array.from({ length: 24 }, (_, h) => hourLabel(h))],
  rows: grid.map((row, d) => [DAYS[d], ...row]),
});

/** Today in Manila, as YYYY-MM-DD (the latest day worth picking in a date filter). */
export function manilaToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
}
