import { manilaToday } from '../utils/chartData';

// From/To days for a list (HANDOFF.md §52). Days are Philippine days; the
// server includes both ends. Empty = no limit on that side.
type Props = {
  idPrefix: string;
  from: string;
  to: string;
  onChange: (changes: { from?: string; to?: string }) => void;
};

export function DateRangeFields({ idPrefix, from, to, onChange }: Props) {
  const today = manilaToday();
  return (
    <>
      <div className="field">
        <label htmlFor={`${idPrefix}-from`}>From</label>
        <input
          id={`${idPrefix}-from`}
          type="date"
          value={from}
          max={to || today}
          onChange={(event) => onChange({ from: event.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor={`${idPrefix}-to`}>To</label>
        <input
          id={`${idPrefix}-to`}
          type="date"
          value={to}
          min={from || undefined}
          max={today}
          onChange={(event) => onChange({ to: event.target.value })}
        />
      </div>
      {from || to ? (
        <button type="button" className="btn btn-link" onClick={() => onChange({ from: '', to: '' })}>
          Clear dates
        </button>
      ) : null}
    </>
  );
}
