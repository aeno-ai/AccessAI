import { apiFetch } from '@/api/apiClient';

/**
 * Puts a friend in (or takes them out of) the user's SOS circle — the
 * friends who get their SOS alerts. Adding someone as a friend does NOT put
 * them in the circle; this does. Used by Settings → Emergency SOS, the
 * shield in each chat, and Accel ("add Ana to my SOS circle").
 * Needs the internet; throws a readable error otherwise.
 */
export async function setSosCircle(friendId: string, inCircle: boolean): Promise<void> {
  await apiFetch(`/friends/${friendId}/sos`, { method: 'PATCH', body: JSON.stringify({ inCircle }) });
}
