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
 * - screen: works only on that screen (accel/screenContext.ts). Asked
 *   elsewhere, Accel says where to go first.
 */
export type IntentCategory =
  | 'Go to'
  | 'Emergency'
  | 'Read aloud'
  | 'Friends & messages'
  | 'Conversation mode'
  | 'Learn'
  | 'Voice & text';

export type IntentInfo = {
  label: string;
  category: IntentCategory;
  confirm: boolean;
  guide?: { en: string; fil?: string };
  screen?: string;
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
  'nav.learn': { label: 'Learn sign language', category: 'Go to', confirm: true, guide: { en: 'Learn sign language' } },
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
  'read.chat_with': {
    label: 'a chat with a friend, read aloud',
    category: 'Read aloud',
    confirm: false,
    guide: { en: 'Read my chat with Ana', fil: 'Basahin ang usapan namin ni Ana' },
  },
  'read.my_last_message': {
    label: 'your last message to a friend',
    category: 'Read aloud',
    confirm: false,
    guide: { en: 'Read my last message to Ana', fil: 'Ano huling sinabi ko kay Ana?' },
  },
  'read.older_messages': {
    label: 'older messages',
    category: 'Read aloud',
    confirm: false,
    guide: { en: 'Older messages', fil: 'Mga naunang message' },
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
  'msg.reply': {
    label: 'reply to a message',
    category: 'Friends & messages',
    confirm: true,
    guide: { en: "Reply I'm coming", fil: 'Sagutin si Ana' },
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

  // ---- what's on the screen (every screen)
  'read.screen': {
    label: "what's on this screen",
    category: 'Read aloud',
    confirm: false,
    guide: { en: "What's on this screen?", fil: "Ano'ng nandito?" },
  },
  'read.recent_sos': {
    label: 'recent SOS',
    category: 'Emergency',
    confirm: false,
    guide: { en: 'Who sent an SOS recently?', fil: 'Sino ang nag-SOS?' },
  },
  'nav.last_conversation': {
    label: 'your last conversation',
    category: 'Go to',
    confirm: true,
    guide: { en: 'Open my last conversation', fil: 'Buksan ang huling usapan' },
  },

  // ---- Chats
  'chats.open': { label: 'a saved conversation', category: 'Go to', confirm: true, screen: 'Chats', guide: { en: 'Open Ate Lyka' } },
  'chats.read_newest': {
    label: 'the newest conversation, read aloud',
    category: 'Read aloud',
    confirm: false,
    screen: 'Chats',
    guide: { en: 'Read the newest one' },
  },

  // ---- Conversation mode (asked elsewhere, "start a conversation" opens it)
  'conv.start': {
    label: 'a new conversation',
    category: 'Conversation mode',
    confirm: true,
    screen: 'Conversation mode',
    guide: { en: 'Start a conversation called Ate Lyka', fil: 'Bagong usapan' },
  },
  'conv.my_turn': { label: 'your turn', category: 'Conversation mode', confirm: false, screen: 'Conversation mode', guide: { en: 'My turn', fil: 'Ako na' } },
  'conv.their_turn': {
    label: 'their turn',
    category: 'Conversation mode',
    confirm: false,
    screen: 'Conversation mode',
    guide: { en: 'Their turn', fil: 'Siya na' },
  },
  'conv.say': {
    label: 'say it aloud',
    category: 'Conversation mode',
    confirm: true,
    screen: 'Conversation mode',
    guide: { en: 'Say I need to go to the clinic', fil: 'Sabihin mo gutom na ako' },
  },
  'conv.read_last': {
    label: 'what they said',
    category: 'Conversation mode',
    confirm: false,
    screen: 'Conversation mode',
    guide: { en: 'Read what they said', fil: 'Ano sinabi niya?' },
  },
  'conv.read_all': {
    label: 'the conversation, read aloud',
    category: 'Conversation mode',
    confirm: false,
    screen: 'Conversation mode',
    guide: { en: 'Read the conversation' },
  },
  'conv.quick_replies': {
    label: 'your quick replies',
    category: 'Conversation mode',
    confirm: false,
    screen: 'Conversation mode',
    guide: { en: 'Quick replies' },
  },
  'conv.say_reply': {
    label: 'a quick reply, said aloud',
    category: 'Conversation mode',
    confirm: true,
    screen: 'Conversation mode',
    guide: { en: 'Say quick reply 2' },
  },
  'conv.sign_mode': {
    label: 'sign language mode',
    category: 'Conversation mode',
    confirm: false,
    screen: 'Conversation mode',
    guide: { en: 'Sign mode on' },
  },
  'conv.rename': {
    label: 'rename the conversation',
    category: 'Conversation mode',
    confirm: true,
    screen: 'Conversation mode',
    guide: { en: 'Rename it to Dagupan trip' },
  },
  'conv.end': {
    label: 'end the conversation',
    category: 'Conversation mode',
    confirm: true,
    screen: 'Conversation mode',
    guide: { en: 'End the conversation' },
  },

  // ---- Learn (the next lesson and practice work from anywhere)
  'learn.next_lesson': { label: 'the next lesson', category: 'Learn', confirm: true, guide: { en: 'Start the next lesson', fil: 'Simulan ang lesson' } },
  'learn.practice': { label: 'sign practice', category: 'Learn', confirm: true, guide: { en: 'Practise signs' } },
  'learn.choose': { label: 'an answer', category: 'Learn', confirm: false, screen: 'a Learn lesson', guide: { en: 'The first one', fil: 'Yung pangalawa' } },
  'learn.check': { label: 'check the answer', category: 'Learn', confirm: false, screen: 'a Learn lesson', guide: { en: 'Check' } },
  'learn.continue': { label: 'continue', category: 'Learn', confirm: false, screen: 'a Learn lesson', guide: { en: 'Continue', fil: 'Tuloy' } },
  'learn.hear_steps': { label: 'the steps, read aloud', category: 'Learn', confirm: false, screen: 'a Learn lesson', guide: { en: 'Hear the steps' } },
  'learn.skip': { label: 'skip', category: 'Learn', confirm: false, screen: 'a Learn lesson', guide: { en: 'Skip' } },

  // Never by voice — see actions.ts.
  'blocked.account': { label: 'account changes', category: 'Go to', confirm: false },
  // Other apps, phone settings, calls (other than SOS), the web.
  'blocked.outside': { label: 'other apps', category: 'Go to', confirm: false },
  none: { label: 'nothing', category: 'Go to', confirm: false },
} satisfies Record<string, IntentInfo>;

export type IntentId = keyof typeof INTENTS;

export const isIntentId = (value: unknown): value is IntentId => typeof value === 'string' && value in INTENTS;

/** Details an action may need, pulled out of what was said. */
export type Slots = {
  /** A friend's name — or a conversation's (chats.open, conv.start, conv.rename). */
  friendName?: string;
  /** Words to send or say aloud. */
  messageText?: string;
  friendCode?: string;
  value?: 'man' | 'woman' | 'auto';
  /** "Quick reply 2", "the first one" (1-based). The phone's rules only. */
  number?: number;
  /** "Sign mode on / off". The phone's rules only. */
  on?: boolean;
};

/** Works only on one screen (see `screen` above). */
export const screenOf = (intent: IntentId): string | undefined => (INTENTS[intent] as IntentInfo).screen;
