import { router, type Href } from 'expo-router';
import type { ConversationAction } from '@/constants/profiles';

/**
 * Opens Conversation on a fresh, unnamed conversation (its "name this
 * conversation" step first). `new` differs on every tap, so it works even
 * when the Conversation screen is already showing another one.
 */
export function startNewConversation() {
  router.push({ pathname: '/conversation', params: { new: String(Date.now()) } } as unknown as Href);
}

/** Opens Conversation on a fresh conversation already named `title` (Accel: "start a conversation called Ate Lyka"). */
export function startNamedConversation(title: string) {
  router.push({ pathname: '/conversation', params: { new: String(Date.now()), title } } as unknown as Href);
}

/** Opens Conversation ready to do one thing: listen, show captions, sign or type. */
export function openConversationFor(action: ConversationAction) {
  router.push({ pathname: '/conversation', params: { action, opened: String(Date.now()) } } as unknown as Href);
}

/** Opens a saved conversation (from Chats or Home's recent list). */
export function openSavedConversation(id: string) {
  // `opened` differs on every tap, so the screen reloads this conversation
  // even if it was the last one open.
  router.push({ pathname: '/conversation', params: { id, opened: String(Date.now()) } } as unknown as Href);
}
