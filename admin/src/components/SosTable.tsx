import { Link } from 'react-router';
import type { SosRecord } from '../types';
import { ANSWER_LABELS, SOS_ENDED_LABELS, formatDateTime } from '../utils/format';

type SosTableProps = {
  events: SosRecord[];
  caption: string;
  // Hidden on one person's own page.
  showSender?: boolean;
  busy?: boolean;
};

// SOS records: who, when, who answered and how it ended. The place, the
// location and the message are never sent to the admin panel.
export function SosTable({ events, caption, showSender = true, busy = false }: SosTableProps) {
  const columns = showSender ? 6 : 5;
  return (
    <div className="table-wrap" aria-busy={busy}>
      <table>
        <caption className="visually-hidden">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Sent</th>
            {showSender ? <th scope="col">From</th> : null}
            <th scope="col">Kind</th>
            <th scope="col">Friends alerted</th>
            <th scope="col">Answers</th>
            <th scope="col">Ended</th>
          </tr>
        </thead>
        <tbody>
          {events.length === 0 ? (
            <tr>
              <td colSpan={columns} className="empty">
                No SOS records.
              </td>
            </tr>
          ) : (
            events.map((event) => (
              <tr key={event.id}>
                <td>{formatDateTime(event.sentAt)}</td>
                {showSender ? (
                  <td>
                    {event.sender ? (
                      <Link to={`/users/${event.sender.id}`}>{event.sender.name || event.sender.email}</Link>
                    ) : (
                      <span className="muted">Deleted account</span>
                    )}
                  </td>
                ) : null}
                <td>
                  <span className={`badge ${event.isTest ? '' : 'badge-danger'}`}>{event.isTest ? 'Test' : 'Real'}</span>
                </td>
                <td>{event.alerted}</td>
                <td>
                  {event.noOneAnswered ? (
                    <span className="badge badge-warning">No one answered</span>
                  ) : (
                    <ul className="plain-list">
                      {event.answers.map((answer, index) => (
                        <li key={`${answer.id ?? 'gone'}-${index}`}>
                          {answer.id ? <Link to={`/users/${answer.id}`}>{answer.name}</Link> : answer.name}:{' '}
                          {ANSWER_LABELS[answer.kind]}, {formatDateTime(answer.at)}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
                <td>
                  {event.status === 'active' ? (
                    <span className="badge badge-danger">Still active</span>
                  ) : (
                    <>
                      {event.ended ? SOS_ENDED_LABELS[event.ended] : 'Ended'}
                      {event.endedAt ? `, ${formatDateTime(event.endedAt)}` : ''}
                    </>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
