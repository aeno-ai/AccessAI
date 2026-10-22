import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { apiFetch, errorMessage } from '../api/client';
import { BreakdownBars, ChartCard, HourHeatmap, TimeArea, TimeBars, TimeLines } from '../components/charts';
import { PageLoader } from '../components/PageLoader';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import type { DashboardRange, DashboardResponse } from '../types';
import { heatmapTable, seriesTable, type Series } from '../utils/chartData';
import { USER_STATUS_LABELS, formatDateTime } from '../utils/format';

const RANGES: { value: DashboardRange; label: string }[] = [
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
];

// Times are shown in Philippine time, like the buckets the server made.
const hourFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', timeZone: 'Asia/Manila' });
const dayFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });

const REASON_LABELS: Record<string, string> = {
  'wrong password': 'Wrong password',
  'no password (Google account)': 'Google account (no password)',
  'no account with that email': 'No account with that email',
};
const SOS_TRIGGER_LABELS: Record<string, string> = {
  'app-hold-confirm': 'Held the SOS button',
  button: 'Pressed the SOS button (older app)',
  shake: 'Shook the phone',
  voice: 'Asked Laya',
  test: 'Test SOS',
};
const SOS_OUTCOME_LABELS: Record<string, string> = {
  safe: 'Marked safe',
  expired: 'Ran out (24 h)',
  replaced: 'Replaced by a new SOS',
  active: 'Still active',
  resolved: 'Ended',
};

function Kpi({ label, value, detail, to }: { label: string; value: string | number; detail?: string; to?: string }) {
  const body = (
    <>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      {detail ? <span className="kpi-detail">{detail}</span> : null}
    </>
  );
  return <li className="kpi">{to ? <Link to={to}>{body}</Link> : body}</li>;
}

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

// The dashboard (HANDOFF.md §52): every log as numbers over time —
// accounts, logins, SOS, messages, Learn, limits and admin actions — plus
// breakdowns and the busiest hours. Counts only: never what anyone said,
// sent or where they were.
export default function DashboardPage() {
  useDocumentTitle('Dashboard');
  const [range, setRange] = useState<DashboardRange>('7d');
  const [data, setData] = useState<DashboardResponse | null>(null);
  // Which request the last answer belongs to (range + refresh count): while
  // they differ it's loading, and the old numbers stay on screen, dimmed.
  const [version, setVersion] = useState(0);
  const request = `${range}:${version}`;
  const [answered, setAnswered] = useState({ request: '', error: '' });
  const loading = answered.request !== request;
  const error = loading ? '' : answered.error;

  useEffect(() => {
    let cancelled = false;
    apiFetch<DashboardResponse>(`/dashboard?range=${range}`)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setAnswered({ request, error: '' });
      })
      .catch((e: unknown) => {
        if (!cancelled) setAnswered({ request, error: errorMessage(e) });
      });
    return () => {
      cancelled = true;
    };
  }, [range, request]);
  const load = () => setVersion((v) => v + 1);

  const labels = data ? data.buckets.map((b) => (data.unit === 'hour' ? hourFmt : dayFmt).format(new Date(b))) : [];
  const k = data?.kpis;
  const rangeLabel = RANGES.find((r) => r.value === range)?.label.toLowerCase() ?? '';

  const logins: Series[] = data
    ? [
        { key: 'ok', label: 'Successful', values: data.series.logins.success },
        { key: 'failed', label: 'Failed', values: data.series.logins.failed },
        { key: 'refused', label: 'Refused (locked account)', values: data.series.logins.refused },
      ]
    : [];
  const sos: Series[] = data
    ? [
        { key: 'real', label: 'Real', values: data.series.sos.real },
        { key: 'test', label: 'Test', values: data.series.sos.test },
      ]
    : [];
  const learn: Series[] = data
    ? [
        { key: 'fsl', label: 'FSL', values: data.series.learn.fsl },
        { key: 'asl', label: 'ASL', values: data.series.learn.asl },
      ]
    : [];
  const one = (key: string, label: string, values: number[]): Series => ({ key, label, values });

  return (
    <section className="page dashboard">
      <div className="dashboard-head">
        <div>
          <h1>Dashboard</h1>
          <p className="muted">
            Everything the logs record, as numbers over time (Philippine time). Counts only — never what anyone said,
            sent or where they were.
          </p>
        </div>
        <div className="dashboard-controls">
          <div className="segmented" role="group" aria-label="Time range">
            {RANGES.map((r) => (
              <button
                key={r.value}
                type="button"
                className={r.value === range ? 'active' : ''}
                aria-pressed={r.value === range}
                onClick={() => setRange(r.value)}
              >
                {r.label.replace('Last ', '')}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-secondary btn-small" onClick={load} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          {data ? <span className="muted small">Updated {formatDateTime(data.generatedAt)}</span> : null}
        </div>
      </div>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {!data && !error ? <PageLoader /> : null}

      {data && k ? (
        <div className={loading ? 'dashboard-body is-loading' : 'dashboard-body'}>
          <ul className="kpis" aria-label={`Key numbers, ${rangeLabel}`}>
            <Kpi label="Accounts" value={k.users} detail={`${k.pwd} PWD · ${k.nonPwd} non-PWD`} to="/users" />
            <Kpi label="New sign-ups" value={k.newSignups} detail={rangeLabel} />
            <Kpi label="Active users" value={k.activeUsers} detail="logged in this period" />
            <Kpi label="Logins" value={k.loginsOk} detail={`${k.loginsFailed} failed · ${k.loginsRefused} refused`} to="/activity?type=login.failed" />
            <Kpi label="Real SOS" value={k.sosReal} detail={`${k.sosUnanswered} unanswered · ${k.sosTest} tests`} to="/sos?kind=real" />
            <Kpi
              label="First answer to an SOS"
              value={k.sosMedianAnswerMinutes === null ? '—' : `${k.sosMedianAnswerMinutes < 1 ? '<1' : Math.round(k.sosMedianAnswerMinutes)} min`}
              detail="median, real SOS"
            />
            <Kpi label="Suspicious now" value={k.suspicious} detail={`${k.suspiciousHigh} high severity · last 24 h`} to="/review" />
            <Kpi label="Admin actions" value={k.adminActions} detail={rangeLabel} />
          </ul>

          <div className="chart-grid">
            <ChartCard title="Logins" note="Successful, failed and refused logins." table={seriesTable(labels, logins)} wide>
              <TimeLines labels={labels} series={logins} />
            </ChartCard>
            <ChartCard title="SOS alerts" note="Real and test SOS sent." table={seriesTable(labels, sos)}>
              <TimeBars labels={labels} series={sos} />
            </ChartCard>
            <ChartCard title="New sign-ups" note={`${sum(data.series.signups)} ${rangeLabel}.`} table={seriesTable(labels, [one('signups', 'Sign-ups', data.series.signups)])}>
              <TimeBars labels={labels} series={[one('signups', 'Sign-ups', data.series.signups)]} />
            </ChartCard>
            <ChartCard title="Messages sent" note="Chat messages between friends (a count only)." table={seriesTable(labels, [one('messages', 'Messages', data.series.messages)])}>
              <TimeArea labels={labels} series={one('messages', 'Messages', data.series.messages)} />
            </ChartCard>
            <ChartCard title="Learn lessons finished" note="By sign language." table={seriesTable(labels, learn)}>
              <TimeBars labels={labels} series={learn} />
            </ChartCard>
            <ChartCard title="Usage limits hit" note="At most one per person per limit per minute." table={seriesTable(labels, [one('limits', 'Limits hit', data.series.limitHits)])}>
              <TimeBars labels={labels} series={[one('limits', 'Limits hit', data.series.limitHits)]} />
            </ChartCard>
            <ChartCard title="Admin actions" note="Everything admins did (see the admin log)." table={seriesTable(labels, [one('admin', 'Admin actions', data.series.adminActions)])}>
              <TimeBars labels={labels} series={[one('admin', 'Admin actions', data.series.adminActions)]} />
            </ChartCard>
            <ChartCard
              title="Busiest hours"
              note={`All activity records by day and hour, ${rangeLabel}.`}
              table={heatmapTable(data.heatmap)}
              wide
            >
              <HourHeatmap grid={data.heatmap} />
            </ChartCard>
          </div>

          <h2 className="section-title">Breakdowns ({rangeLabel})</h2>
          <div className="chart-grid">
            {(
              [
                ['Accounts by status', data.breakdowns.userStatus, (key: string) => USER_STATUS_LABELS[key as keyof typeof USER_STATUS_LABELS] ?? key, 'All accounts, right now.'],
                ['App versions', data.breakdowns.appVersions, (key: string) => (key === 'unknown' ? 'Unknown' : `Version ${key}`), undefined],
                ['Why logins failed', data.breakdowns.failedReasons, (key: string) => REASON_LABELS[key] ?? key, undefined],
                ['Limits hit', data.breakdowns.limiters, (key: string) => key, undefined],
                ['How SOS were started', data.breakdowns.sosTriggers, (key: string) => SOS_TRIGGER_LABELS[key] ?? key, undefined],
                ['How SOS ended', data.breakdowns.sosOutcomes, (key: string) => SOS_OUTCOME_LABELS[key] ?? key, undefined],
              ] as const
            ).map(([title, rows, labelOf, note]) => (
              <ChartCard
                key={title}
                title={title}
                note={note}
                table={{ columns: ['What', 'Count'], rows: rows.map((r) => [labelOf(r.key), r.count]) }}
              >
                <BreakdownBars data={rows} labelOf={labelOf} />
              </ChartCard>
            ))}
          </div>
          <p className="muted small">
            Login and activity records are kept {data.activityRetentionDays} days, so longer ranges start empty.
          </p>
        </div>
      ) : null}
    </section>
  );
}
