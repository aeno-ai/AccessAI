import type { UserStatus } from '../types';
import { USER_STATUS_BADGES, USER_STATUS_LABELS } from '../utils/format';

export function UserStatusBadge({ status }: { status: UserStatus }) {
  return <span className={`badge ${USER_STATUS_BADGES[status]}`}>{USER_STATUS_LABELS[status]}</span>;
}
