/**
 * Stub for syncing locally stored conversations up to the backend.
 *
 * There is currently no backend endpoint to sync conversations/messages to,
 * so this is intentionally a no-op placeholder — conversations are fully
 * local-only for now (see the plan's "Offline storage" section). Once a
 * backend Conversation/Message API exists, this is where the upload logic
 * belongs: push any conversation whose `syncedAt` is older than its
 * `updatedAt` (or null), then stamp `syncedAt` locally on success.
 */
export async function syncConversations(): Promise<void> {
  // TODO: implement once a backend conversation-sync endpoint exists.
}
