const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Title for a conversation the user didn't name, e.g.
 * "[Sep 8, 2026] Unnamed conversation". Date first, so unnamed ones are easy
 * to tell apart in History. Built by hand rather than with toLocaleDateString
 * so it reads the same on every phone, whatever its language settings.
 */
export function unnamedConversationTitle(date: Date = new Date()): string {
  return `[${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}] Unnamed conversation`;
}
