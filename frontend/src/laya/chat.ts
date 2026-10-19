/**
 * Reading friends' chats aloud for Laya: which chat is open, how a message
 * sounds ("Andrew said: …"), and the messages to read — newest first in
 * pages, but each page read oldest first, like a conversation.
 */
import { backfill, getDirectMessages, type DirectMessage } from '@/db/directMessages';
import type { Friend } from '@/db/friends';
import { inLang, P, type Lang } from '@/laya/phrases';

/** The friend whose chat is open on screen (`/chat/<id>`), if any. */
export function chatFriend(ctx: { pathname: string; friends: Friend[] }): Friend | null {
  if (!ctx.pathname.startsWith('/chat/')) return null;
  const id = ctx.pathname.split('/')[2];
  return ctx.friends.find((friend) => friend.userId === id) ?? null;
}

export const nameOf = (friend: Friend) => friend.firstName || friend.name;

// A full stop at the end, so the voice pauses before the next message.
const sentence = (text: string) => (/[.!?…]$/.test(text.trim()) ? text.trim() : `${text.trim()}.`);

/** One message, as Laya reads it: "Andrew said: …", "You said: …" (or in Filipino). */
export function lineFor(message: DirectMessage, friend: Friend, lang: Lang = 'en'): string {
  return inLang(lang, P.messageLine(message.fromMe ? 'me' : nameOf(friend), sentence(message.body), message.kind === 'sos'));
}

/** "just now", "5 minutes ago", "2 hours ago", "on Monday" — or in Filipino. */
export function spokenAgo(at: number, lang: Lang = 'en'): string {
  const minutes = Math.round((Date.now() - at) / 60000);
  if (minutes < 1) return inLang(lang, P.justNow);
  if (minutes < 60) return inLang(lang, P.minutesAgo(minutes));
  const hours = Math.round(minutes / 60);
  if (hours < 24) return inLang(lang, P.hoursAgo(hours));
  const day = new Date(at).toLocaleDateString(lang === 'fil' ? 'fil-PH' : undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  return lang === 'fil' ? `noong ${day}` : `on ${day}`;
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
