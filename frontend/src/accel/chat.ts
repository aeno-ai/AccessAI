/**
 * Reading friends' chats aloud for Accel: which chat is open, how a message
 * sounds ("Andrew said: …"), and the messages to read — newest first in
 * pages, but each page read oldest first, like a conversation.
 */
import { backfill, getDirectMessages, type DirectMessage } from '@/db/directMessages';
import type { Friend } from '@/db/friends';

/** The friend whose chat is open on screen (`/chat/<id>`), if any. */
export function chatFriend(ctx: { pathname: string; friends: Friend[] }): Friend | null {
  if (!ctx.pathname.startsWith('/chat/')) return null;
  const id = ctx.pathname.split('/')[2];
  return ctx.friends.find((friend) => friend.userId === id) ?? null;
}

export const nameOf = (friend: Friend) => friend.firstName || friend.name;

// A full stop at the end, so the voice pauses before the next message.
const sentence = (text: string) => (/[.!?…]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`);

/** One message, as Accel reads it: "Andrew said: …", "You said: …". */
export function lineFor(message: DirectMessage, friend: Friend): string {
  const who = message.fromMe ? 'You' : nameOf(friend);
  if (message.kind === 'sos') return `${who} sent an SOS: ${sentence(message.body)}`;
  return `${who} said: ${sentence(message.body)}`;
}

/** "just now", "5 minutes ago", "2 hours ago", "on Monday". */
export function spokenAgo(at: number): string {
  const minutes = Math.round((Date.now() - at) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  return `on ${new Date(at).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}`;
}

/**
 * The whole chat, oldest first, after catching up with the server when
 * online (best effort — offline it's what's saved on the phone). Messages
 * the server refused are left out.
 */
export async function chatMessages(friendId: string, online: boolean): Promise<DirectMessage[]> {
  if (online) await backfill(friendId).catch(() => 0);
  return (await getDirectMessages(friendId)).filter((message) => message.status !== 'failed');
}

/** `count` messages before the newest `skip` ones, oldest first. */
export function pageFromNewest(messages: DirectMessage[], count: number, skip: number): DirectMessage[] {
  const end = Math.max(0, messages.length - skip);
  return messages.slice(Math.max(0, end - count), end);
}

/** The friend's unread messages (their newest `friend.unread`), oldest first. */
export function unreadFrom(messages: DirectMessage[], friend: Friend): DirectMessage[] {
  const theirs = messages.filter((message) => !message.fromMe);
  return friend.unread > 0 ? theirs.slice(Math.max(0, theirs.length - friend.unread)) : [];
}
