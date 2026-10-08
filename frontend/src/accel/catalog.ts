/**
 * Everything Accel can do — the app's copy of the list in ai/intents.json.
 * The ids MUST match that file (check: `node scripts/check-accel-catalog.mjs`
 * in frontend/). The AI only ever picks an id; what happens is decided
 * here and in actions.ts, so the AI can never do anything not on this list.
 *
 * - label: what Accel calls the place or action out loud
 * - confirm: Accel asks "yes or no?" first (everything that changes
 *   something or moves you somewhere). Reading things aloud doesn't ask.
 * - guide: example sentences for the "What Accel can do" screen
 */
export type IntentCategory = 'Go to' | 'Emergency' | 'Read aloud' | 'Friends & messages' | 'Voice & text';

export type IntentInfo = {
  label: string;
  category: IntentCategory;
  confirm: boolean;
  guide?: { en: string; fil?: string };
};

export const INTENTS = {
  'nav.home': { label: 'Home', category: 'Go to', confirm: true, guide: { en: 'Go home', fil: 'Punta sa home' } },
  'nav.conversation': {
    label: 'Conversation mode',
    category: 'Go to',
    confirm: true,
    guide: { en: 'Take me to conversation mode', fil: 'Gusto kong makipag-usap' },
  },
  'nav.chats': { label: 'Chats, your saved conversations', category: 'Go to', confirm: true, guide: { en: 'Open my chats' } },
  'nav.friends': { label: 'Friends', category: 'Go to', confirm: true, guide: { en: 'Open friends', fil: 'Mga kaibigan ko' } },
  'nav.friend_requests': { label: 'Friend requests', category: 'Go to', confirm: true, guide: { en: 'Open friend requests' } },
  'nav.add_friend': {
    label: 'Add a friend',
    category: 'Friends & messages',
    confirm: true,
    guide: { en: 'Add a friend', fil: 'Magdagdag ng kaibigan' },
  },
  'nav.chat_with': {
    label: 'a chat with a friend',
    category: 'Friends & messages',
    confirm: true,
    guide: { en: 'Open my chat with Ana', fil: 'Buksan ang chat namin ni Ana' },
  },
  'nav.learn': { label: 'Learn', category: 'Go to', confirm: true, guide: { en: 'Open learn' } },
  'nav.settings': { label: 'Settings', category: 'Go to', confirm: true, guide: { en: 'Open settings' } },
  'nav.settings_needs': { label: 'Settings, My needs', category: 'Go to', confirm: true, guide: { en: 'Change my profile type' } },
  'nav.settings_display': { label: 'Settings, Display and text', category: 'Go to', confirm: true, guide: { en: 'Display settings' } },
  'nav.settings_speech': {
    label: 'Settings, Conversation and speech',
    category: 'Go to',
    confirm: true,
    guide: { en: 'Voice settings' },
  },
  'nav.settings_alerts': { label: 'Settings, Alerts', category: 'Go to', confirm: true, guide: { en: 'Alert settings' } },
  'nav.settings_sos': {
    label: 'Settings, Emergency SOS',
    category: 'Emergency',
    confirm: true,
    guide: { en: 'Who gets my SOS' },
  },
  'nav.settings_accel': { label: 'Settings, Accel', category: 'Go to', confirm: true, guide: { en: 'Accel settings' } },
  'nav.emergency_contacts': {
    label: 'Emergency contacts',
    category: 'Emergency',
    confirm: true,
    guide: { en: 'Open my emergency contacts' },
  },
  'nav.profile': { label: 'Edit profile', category: 'Go to', confirm: true, guide: { en: 'Edit my profile' } },
  'nav.accel_guide': { label: 'the Accel guide', category: 'Go to', confirm: true, guide: { en: 'Show me what you can do' } },
  'nav.back': { label: 'the previous screen', category: 'Go to', confirm: true, guide: { en: 'Go back', fil: 'Bumalik' } },
  // The SOS countdown is its own confirmation: it can be cancelled.
  'sos.send': { label: 'an SOS', category: 'Emergency', confirm: false, guide: { en: 'Send SOS', fil: 'Tulong' } },
  'sos.im_safe': { label: "I'm safe", category: 'Emergency', confirm: true, guide: { en: "I'm safe now", fil: 'Ligtas na ako' } },
  'sos.circle_add': {
    label: 'add to SOS circle',
    category: 'Emergency',
    confirm: true,
    guide: { en: 'Add Ana to my SOS circle' },
  },
  'sos.circle_remove': {
    label: 'remove from SOS circle',
    category: 'Emergency',
    confirm: true,
    guide: { en: 'Remove Ana from my SOS circle' },
  },
  'read.new_messages': {
    label: 'new messages',
    category: 'Read aloud',
    confirm: false,
    guide: { en: 'Any new messages?', fil: 'May bagong message ba?' },
  },
  'read.last_message_from': {
    label: "a friend's last message",
    category: 'Read aloud',
    confirm: false,
    guide: { en: "Read Ana's last message", fil: 'Ano sabi ni Ana?' },
  },
  'read.who_online': { label: "who's online", category: 'Read aloud', confirm: false, guide: { en: "Who's online?" } },
  'read.where_am_i': { label: 'where you are', category: 'Read aloud', confirm: false, guide: { en: 'Where am I?', fil: 'Nasaan ako?' } },
  'read.help': { label: 'help', category: 'Read aloud', confirm: false, guide: { en: 'What can I say?' } },
  'read.repeat': { label: 'repeat', category: 'Read aloud', confirm: false, guide: { en: 'Say that again', fil: 'Pakiulit' } },
  'read.my_friend_code': {
    label: 'your friend code',
    category: 'Friends & messages',
    confirm: false,
    guide: { en: "What's my friend code?" },
  },
  'read.friend_requests': {
    label: 'friend requests',
    category: 'Friends & messages',
    confirm: false,
    guide: { en: 'Any friend requests?' },
  },
  'msg.send': {
    label: 'send a message',
    category: 'Friends & messages',
    confirm: true,
    guide: { en: "Tell Ana I'm on my way", fil: 'Sabihin mo kay Ana pauwi na ako' },
  },
  'friend.add_code': {
    label: 'add a friend by code',
    category: 'Friends & messages',
    confirm: true,
    guide: { en: 'Add friend code ABCD 2345' },
  },
  'friend.accept_request': {
    label: 'accept a friend request',
    category: 'Friends & messages',
    confirm: true,
    guide: { en: "Accept Ana's request" },
  },
  'friend.decline_request': {
    label: 'decline a friend request',
    category: 'Friends & messages',
    confirm: true,
    guide: { en: "Decline Ben's request" },
  },
  'speech.slower': { label: 'speak slower', category: 'Voice & text', confirm: true, guide: { en: 'Speak slower', fil: 'Dahan-dahan' } },
  'speech.faster': { label: 'speak faster', category: 'Voice & text', confirm: true, guide: { en: 'Speak faster' } },
  'text.bigger': { label: 'bigger text', category: 'Voice & text', confirm: true, guide: { en: 'Make the text bigger' } },
  'text.smaller': { label: 'smaller text', category: 'Voice & text', confirm: true, guide: { en: 'Make the text smaller' } },
  'voice.change': {
    label: 'change the voice',
    category: 'Voice & text',
    confirm: true,
    guide: { en: "Use a woman's voice", fil: 'Lalaki na boses' },
  },
  // Never by voice — see actions.ts.
  'blocked.account': { label: 'account changes', category: 'Go to', confirm: false },
  none: { label: 'nothing', category: 'Go to', confirm: false },
} satisfies Record<string, IntentInfo>;

export type IntentId = keyof typeof INTENTS;

export const isIntentId = (value: unknown): value is IntentId => typeof value === 'string' && value in INTENTS;

/** Details an action may need, pulled out of what was said. */
export type Slots = {
  friendName?: string;
  messageText?: string;
  friendCode?: string;
  value?: 'man' | 'woman' | 'auto';
};
