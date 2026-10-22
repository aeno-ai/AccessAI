import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';
import type { Breakdown } from '../types';
import { DAYS, SERIES_COLORS, hourLabel, type Series } from '../utils/chartData';

// Dashboard charts (HANDOFF.md §52). Colors: the validated categorical
// order (utils/chartData.ts SERIES_COLORS); a single purple ramp for the
// busiest-hours grid. Every chart has a legend when it has two or more
// series, a tooltip, and a "Show as table" for screen readers.
const GRID = '#e8e6ef';
const AXIS = '#5b6270';

const tooltipStyle = { borderRadius: 10, border: '1px solid #e5e7eb', boxShadow: '0 4px 16px rgba(26,26,46,0.08)' };

/** A titled card: the chart, a one-line note, and the same numbers as a table. */
export function ChartCard({
  title,
  note,
  children,
  table,
  wide = false,
}: {
  title: string;
  note?: string;
  children: ReactNode;
  table: { columns: string[]; rows: (string | number)[][] };
  wide?: boolean;
}) {
  return (
    <figure className={`chart-card${wide ? ' chart-wide' : ''}`}>
      <figcaption>
        <h2>{title}</h2>
        {note ? <p className="muted">{note}</p> : null}
      </figcaption>
      <div className="chart-body">{children}</div>
      <details className="chart-table">
        <summary>Show as table</summary>
        <div className="table-wrap">
          <table>
            <caption className="visually-hidden">{title}</caption>
            <thead>
              <tr>
                {table.columns.map((c) => (
                  <th key={c} scope="col">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

/**
 * The chart's width, measured from its card (and followed as the window
 * changes). Recharts' own ResponsiveContainer measured too early on some
 * screens and drew the charts tiny.
 */
function Sized({ height, children }: { height: number; children: (width: number) => ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => setWidth(Math.floor(element.getBoundingClientRect().width));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ width: '100%', height }}>
      {width > 0 ? children(width) : null}
    </div>
  );
}

function rowsOf(labels: string[], series: Series[]) {
  return labels.map((label, i) => Object.fromEntries([['label', label], ...series.map((s) => [s.key, s.values[i] ?? 0])]));
}

const margin = { top: 8, right: 12, bottom: 0, left: 0 };

function axes() {
  return [
    <CartesianGrid key="grid" stroke={GRID} vertical={false} />,
    <XAxis key="x" dataKey="label" tick={{ fill: AXIS, fontSize: 12 }} tickLine={false} axisLine={{ stroke: GRID }} minTickGap={16} />,
    <YAxis key="y" allowDecimals={false} tick={{ fill: AXIS, fontSize: 12 }} tickLine={false} axisLine={false} width={40} />,
  ];
}

/** Lines over time (e.g. logins ok / failed / refused). */
export function TimeLines({ labels, series, height = 260 }: { labels: string[]; series: Series[]; height?: number }) {
  return (
    <Sized height={height}>
      {(width) => (
        <LineChart width={width} height={height} data={rowsOf(labels, series)} margin={margin}>
          {axes()}
          <Tooltip contentStyle={tooltipStyle} />
          {series.length > 1 ? <Legend iconType="plainline" /> : null}
          {series.map((s, i) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
            />
          ))}
        </LineChart>
      )}
    </Sized>
  );
}

/** Bars over time; several series are stacked (e.g. real / test SOS). */
export function TimeBars({ labels, series, height = 240 }: { labels: string[]; series: Series[]; height?: number }) {
  return (
    <Sized height={height}>
      {(width) => (
        <BarChart width={width} height={height} data={rowsOf(labels, series)} margin={margin} barCategoryGap="18%">
          {axes()}
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(108,92,231,0.06)' }} />
          {series.length > 1 ? <Legend iconType="square" /> : null}
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stackId="stack"
              fill={SERIES_COLORS[i % SERIES_COLORS.length]}
              stroke="#fff"
              strokeWidth={1}
              radius={i === series.length - 1 ? [4, 4, 0, 0] : 0}
            />
          ))}
        </BarChart>
      )}
    </Sized>
  );
}

/** One series as a soft area (e.g. messages sent). */
export function TimeArea({ labels, series, height = 240 }: { labels: string[]; series: Series; height?: number }) {
  return (
    <Sized height={height}>
      {(width) => (
        <AreaChart width={width} height={height} data={rowsOf(labels, [series])} margin={margin}>
          {axes()}
          <Tooltip contentStyle={tooltipStyle} />
          <Area
            type="monotone"
            dataKey={series.key}
            name={series.label}
            stroke={SERIES_COLORS[0]}
            strokeWidth={2}
            fill={SERIES_COLORS[0]}
            fillOpacity={0.12}
          />
        </AreaChart>
      )}
    </Sized>
  );
}

/** A breakdown as horizontal bars, biggest first, each labelled with its count. */
export function BreakdownBars({ data, labelOf = (key) => key }: { data: Breakdown; labelOf?: (key: string) => string }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  if (!data.length || !total) return <p className="muted chart-empty">Nothing in this period.</p>;
  const max = Math.max(...data.map((d) => d.count));
  return (
    <ul className="breakdown">
      {data.map((d) => (
        <li key={d.key}>
          <span className="breakdown-label">{labelOf(d.key)}</span>
          <span className="breakdown-track" aria-hidden="true">
            <span className="breakdown-bar" style={{ width: `${Math.max(2, (d.count / max) * 100)}%` }} />
          </span>
          <span className="breakdown-value">
            {d.count} <span className="muted">({Math.round((d.count / total) * 100)}%)</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

// The busiest-hours grid: one purple, light (quiet) → dark (busy).
const RAMP = ['#f4f2fb', '#dcd6fb', '#bfb4f7', '#9f8ff2', '#7f6aea', '#5f47d9', '#4434b8'];

export function HourHeatmap({ grid }: { grid: number[][] }) {
  const max = Math.max(1, ...grid.flat());
  const shade = (n: number) => (n === 0 ? RAMP[0] : RAMP[Math.min(RAMP.length - 1, 1 + Math.floor((n / max) * (RAMP.length - 2)))]);
  return (
    <div className="heatmap" role="img" aria-label="Activity by day of the week and hour; the table below has the numbers">
      <span />
      {Array.from({ length: 24 }, (_, h) => (
        <span key={h} className="heatmap-hour">
          {h % 3 === 0 ? hourLabel(h) : ''}
        </span>
      ))}
      {grid.map((row, d) => (
        <div key={d} className="heatmap-row">
          <span className="heatmap-day">{DAYS[d]}</span>
          {row.map((n, h) => (
            <span key={h} className="heatmap-cell" style={{ background: shade(n) }} title={`${DAYS[d]} ${hourLabel(h)}: ${n}`} />
          ))}
        </div>
      ))}
      <div className="heatmap-legend" aria-hidden="true">
        <span>Quiet</span>
        {RAMP.map((c) => (
          <span key={c} className="heatmap-cell" style={{ background: c }} />
        ))}
        <span>Busy</span>
      </div>
    </div>
  );
}
