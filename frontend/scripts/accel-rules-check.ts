// Checks Accel's offline rules (src/accel/rules.ts) and helpers on sample
// sentences — English, Filipino and Taglish.
//   npx tsx scripts/accel-rules-check.ts
import { matchFriend, parseFriendCode, parseYesNo, afterWakeWord, findWakeWord, removeWakeWord } from '../src/accel/language';
import type { IntentId, Slots } from '../src/accel/catalog';
import { matchRules, parseNumber } from '../src/accel/rules';
import { currentScreen, registerScreen, screenOffers, type ScreenEntry } from '../src/accel/screenRegistry';
import type { Friend } from '../src/db/friends';

type Case = [string, string, Record<string, string>?];

const CASES: Case[] = [
  ['take me to conversation mode', 'nav.conversation'],
  ['navigate me to coversation mode', 'nav.conversation'],
  ['I want to talk with someone', 'nav.conversation'],
  ['gusto kong makipag-usap', 'nav.conversation'],
  ['I want to talk to a deaf person', 'nav.conversation'],
  ['go home', 'nav.home'],
  ['open my chats', 'nav.chats'],
  ['open friends', 'nav.friends'],
  ['mga kaibigan ko', 'nav.friends'],
  ['open friend requests', 'nav.friend_requests'],
  ['add a friend', 'nav.add_friend'],
  ['open my chat with Ana', 'nav.chat_with', { friendName: 'Ana' }],
  ['chat with Ben', 'nav.chat_with', { friendName: 'Ben' }],
  ['open settings', 'nav.settings'],
  ['I want to learn sign language', 'nav.learn'],
  ['gusto kong matuto ng sign language', 'nav.learn'],
  ['practice signing', 'nav.learn'],
  ['display settings', 'nav.settings_display'],
  ['voice settings', 'nav.settings_speech'],
  ['SOS settings', 'nav.settings_sos'],
  ['who gets my SOS', 'nav.settings_sos'],
  ['accel settings', 'nav.settings_accel'],
  ['open my emergency contacts', 'nav.emergency_contacts'],
  ['edit my profile', 'nav.profile'],
  ['show me what you can do', 'nav.accel_guide'],
  ['go back', 'nav.back'],
  ['bumalik', 'nav.back'],
  ['SOS', 'sos.send'],
  ['help me I am in danger', 'sos.send'],
  ['tulong', 'sos.send'],
  ['saklolo po', 'sos.send'],
  ["I'm safe now", 'sos.im_safe'],
  ['ligtas na ako', 'sos.im_safe'],
  ['add Ana to my SOS circle', 'sos.circle_add', { friendName: 'Ana' }],
  ['remove Ben from my SOS circle', 'sos.circle_remove', { friendName: 'Ben' }],
  ['any new messages', 'read.new_messages'],
  ['may bagong message ba', 'read.new_messages'],
  ["read Ana's last message", 'read.last_message_from', { friendName: 'Ana' }],
  ['what did Ben say', 'read.last_message_from', { friendName: 'Ben' }],
  ['ano sabi ni Carla', 'read.last_message_from', { friendName: 'Carla' }],
  ['who is online', 'read.who_online'],
  ['where am I', 'read.where_am_i'],
  ['nasaan ako', 'read.where_am_i'],
  ['what can I say', 'read.help'],
  ['help', 'read.help'],
  ['say that again', 'read.repeat'],
  ['pakiulit', 'read.repeat'],
  ["what's my friend code", 'read.my_friend_code'],
  ['any friend requests', 'read.friend_requests'],
  ["tell Ana I'm on my way", 'msg.send', { friendName: 'Ana', messageText: "I'm on my way" }],
  ["can you tell Ana I'm on my way", 'msg.send', { friendName: 'Ana', messageText: "I'm on my way" }],
  ['send Ben a message saying I will be late', 'msg.send', { friendName: 'Ben', messageText: 'I will be late' }],
  ['sabihin mo kay Ana pauwi na ako', 'msg.send', { friendName: 'Ana', messageText: 'pauwi na ako' }],
  ['pakisabi kay Tita Rosa nandito na ako', 'msg.send', { friendName: 'Tita Rosa', messageText: 'nandito na ako' }],
  ['add friend code ABCD 2345', 'friend.add_code', { friendCode: 'ABCD-2345' }],
  ['friend code is k 7 m 2 p 9 q 4', 'friend.add_code', { friendCode: 'K7M2-P9Q4' }],
  ["accept Ana's request", 'friend.accept_request', { friendName: 'Ana' }],
  ['accept the friend request', 'friend.accept_request'],
  ['decline the request from Ben', 'friend.decline_request', { friendName: 'Ben' }],
  ['speak slower', 'speech.slower'],
  ['you talk too fast', 'speech.slower'],
  ['dahan-dahan', 'speech.slower'],
  ['speak faster', 'speech.faster'],
  ['make the text bigger', 'text.bigger'],
  ['the words are too small', 'text.bigger'],
  ["use a man's voice", 'voice.change', { value: 'man' }],
  ['babae na boses', 'voice.change', { value: 'woman' }],
  ['delete my account', 'blocked.account'],
  ['sign me out', 'blocked.account'],
  ['unfriend Ana', 'blocked.account'],
  ['hey Accel open friends', 'nav.friends'],
  ['what is the weather', 'none'],
  // Messaging by voice (HANDOFF section 8): who first, then what.
  ['send a message to Ana', 'msg.send', { friendName: 'Ana' }],
  ["send a message to Ana saying I'm outside", 'msg.send', { friendName: 'Ana', messageText: "I'm outside" }],
  ['send Ben a message', 'msg.send', { friendName: 'Ben' }],
  ['message Ana', 'msg.send', { friendName: 'Ana' }],
  ['mag-message kay Ana', 'msg.send', { friendName: 'Ana' }],
  ['send a message', 'msg.send'],
  ["send I'm outside", 'msg.send', { messageText: "I'm outside" }],
  // ...and "text" about the screen is never a message.
  ['text bigger', 'text.bigger'],
  ['text bigger please', 'text.bigger'],
  ['text size bigger', 'text.bigger'],
  ['read my chat with Ana', 'read.chat_with', { friendName: 'Ana' }],
  ['read my messages with Ben', 'read.chat_with', { friendName: 'Ben' }],
  ['what did Ana and I talk about', 'read.chat_with', { friendName: 'Ana' }],
  ['basahin ang usapan namin ni Ana', 'read.chat_with', { friendName: 'Ana' }],
  ['read the messages', 'read.chat_with'],
  ["reply I'm coming", 'msg.reply', { messageText: "I'm coming" }],
  ["reply to Ben I'm coming", 'msg.reply', { friendName: 'Ben', messageText: "I'm coming" }],
  ['sagutin si Ana', 'msg.reply', { friendName: 'Ana' }],
  ['read new messages', 'read.new_messages'],
  ['read my previous message to Andrew', 'read.my_last_message', { friendName: 'Andrew' }],
  ['read my last message', 'read.my_last_message'],
  ['what did I say to Ana', 'read.my_last_message', { friendName: 'Ana' }],
  ['older messages', 'read.older_messages'],
  ['read previous messages', 'read.older_messages'],
  ['hey Accel, older messages', 'read.older_messages'],
  ["open Andrew's conversation", 'nav.chat_with', { friendName: 'Andrew' }],
  // ---- every screen (HANDOFF §27)
  ["what's on this screen", 'read.screen'],
  ['describe this page', 'read.screen'],
  ["ano'ng nandito", 'read.screen'],
  ['what can I do here', 'read.help'],
  ["ano'ng pwede kong gawin dito", 'read.help'],
  ['who sent an SOS recently', 'read.recent_sos'],
  ['sino ang nag-SOS', 'read.recent_sos'],
  ['my last SOS', 'read.recent_sos'],
  ['open my last conversation', 'nav.last_conversation'],
  ['buksan ang huling usapan', 'nav.last_conversation'],
  ['start a conversation called Ate Lyka', 'conv.start', { friendName: 'Ate Lyka' }],
  ['start a new conversation', 'conv.start'],
  ['start a conversation with Ana', 'nav.chat_with', { friendName: 'Ana' }],
  ['start the next lesson', 'learn.next_lesson'],
  ['sign practice', 'learn.practice'],
  ['set my needs to mute', 'nav.settings_needs'],
  // ---- only inside AccessAI
  ['open Facebook', 'blocked.outside'],
  ['call mom', 'blocked.outside'],
  ['tawagan si mama', 'blocked.outside'],
  ['turn on wifi', 'blocked.outside'],
  ['play some music', 'blocked.outside'],
  ['open phone settings', 'blocked.outside'],
  ['open google maps for me', 'blocked.outside'],
  ['pakitawagan ang tatay ko', 'blocked.outside'],
  ['open settings', 'nav.settings'],
  ['call for help', 'sos.send'],
  ['call 911', 'sos.send'],
  // A screen's command said elsewhere: kept as a guess, so Accel says where it works.
  ['my turn', 'conv.my_turn'],
  ['continue', 'none'],
];

let failed = 0;
const slotsMatch = (got: Slots, wanted: Slots) =>
  Object.entries(wanted).every(([key, value]) => (got as Record<string, unknown>)[key] === value);
for (const [text, intent, slots = {}] of CASES) {
  const got = matchRules(text);
  const ok = got.intent === intent && slotsMatch(got.slots, slots);
  if (!ok) failed += 1;
  console.log(`${ok ? '✓' : '✗'} ${JSON.stringify(text)} → ${got.intent} ${JSON.stringify(got.slots)}${ok ? '' : `   (wanted ${intent} ${JSON.stringify(slots)})`}`);
}

// ---- on a screen: its own commands come first (accel/screenContext.ts)
type Offers = (intent: IntentId, slots: Slots) => boolean;
const offering =
  (intents: IntentId[], accepts: Offers = () => true): Offers =>
  (intent, slots) =>
    intents.includes(intent) && accepts(intent, slots);
const CONVERSATION = offering([
  'conv.start', 'conv.my_turn', 'conv.their_turn', 'conv.say', 'conv.read_last', 'conv.read_all',
  'conv.quick_replies', 'conv.say_reply', 'conv.sign_mode', 'conv.rename', 'conv.end',
]);
const CHOICES = ['thank you', 'hello', 'yes', 'no'];
const LESSON = offering(['learn.choose', 'learn.check', 'learn.continue', 'learn.hear_steps', 'learn.skip'], (intent, slots) =>
  intent !== 'learn.choose' || (slots.number ?? 0) > 0 || CHOICES.includes((slots.messageText ?? '').toLowerCase()),
);
const CHATS = offering(['chats.open', 'chats.read_newest'], (intent, slots) =>
  intent !== 'chats.open' || ['ate lyka', 'dagupan trip'].includes((slots.friendName ?? '').toLowerCase()),
);
const SCREEN_CASES: [string, string, Offers, IntentId, Slots?][] = [
  ['my turn', 'Conversation', CONVERSATION, 'conv.my_turn'],
  ['ako na', 'Conversation', CONVERSATION, 'conv.my_turn'],
  ['ako naman', 'Conversation', CONVERSATION, 'conv.my_turn'],
  ['their turn', 'Conversation', CONVERSATION, 'conv.their_turn'],
  ['siya na', 'Conversation', CONVERSATION, 'conv.their_turn'],
  ['say I need to go to the clinic', 'Conversation', CONVERSATION, 'conv.say', { messageText: 'I need to go to the clinic' }],
  ['sabihin mo gutom na ako', 'Conversation', CONVERSATION, 'conv.say', { messageText: 'gutom na ako' }],
  ['sabihin mo kay Ana na pauwi na ako', 'Conversation', CONVERSATION, 'msg.send', { friendName: 'Ana', messageText: 'pauwi na ako' }],
  ['say that again', 'Conversation', CONVERSATION, 'read.repeat'],
  ['what did they say', 'Conversation', CONVERSATION, 'conv.read_last'],
  ['ano sinabi niya', 'Conversation', CONVERSATION, 'conv.read_last'],
  ['what was the last thing the other person said', 'Conversation', CONVERSATION, 'conv.read_last'],
  ['read the conversation', 'Conversation', CONVERSATION, 'conv.read_all'],
  ['quick replies', 'Conversation', CONVERSATION, 'conv.quick_replies'],
  ['say quick reply 2', 'Conversation', CONVERSATION, 'conv.say_reply', { number: 2 }],
  ['quick reply number three', 'Conversation', CONVERSATION, 'conv.say_reply', { number: 3 }],
  ['sign mode off', 'Conversation', CONVERSATION, 'conv.sign_mode', { on: false }],
  ['turn on sign language mode', 'Conversation', CONVERSATION, 'conv.sign_mode', { on: true }],
  ['rename it to Dagupan trip', 'Conversation', CONVERSATION, 'conv.rename', { friendName: 'Dagupan trip' }],
  ['end the conversation', 'Conversation', CONVERSATION, 'conv.end'],
  ['start a conversation', 'Conversation', CONVERSATION, 'conv.start'],
  ['go home', 'Conversation', CONVERSATION, 'nav.home'],
  ['SOS', 'Conversation', CONVERSATION, 'sos.send'],
  ['the second one', 'a lesson', LESSON, 'learn.choose', { number: 2 }],
  ['yung pangalawa', 'a lesson', LESSON, 'learn.choose', { number: 2 }],
  ['thank you', 'a lesson', LESSON, 'learn.choose', { messageText: 'thank you' }],
  ['choose hello', 'a lesson', LESSON, 'learn.choose', { messageText: 'hello' }],
  ['check', 'a lesson', LESSON, 'learn.check'],
  ['continue', 'a lesson', LESSON, 'learn.continue'],
  ['hear the steps', 'a lesson', LESSON, 'learn.hear_steps'],
  ['skip', 'a lesson', LESSON, 'learn.skip'],
  ['go home', 'a lesson', LESSON, 'nav.home'],
  ['tulong', 'a lesson', LESSON, 'sos.send'],
  ['open Ate Lyka', 'Chats', CHATS, 'chats.open', { friendName: 'Ate Lyka' }],
  ['open friends', 'Chats', CHATS, 'nav.friends'],
  ['read the newest one', 'Chats', CHATS, 'chats.read_newest'],
];
for (const [text, where, offers, intent, slots = {}] of SCREEN_CASES) {
  const got = matchRules(text, offers);
  const ok = got.intent === intent && slotsMatch(got.slots, slots);
  if (!ok) failed += 1;
  console.log(`${ok ? '✓' : '✗'} [${where}] ${JSON.stringify(text)} → ${got.intent} ${JSON.stringify(got.slots)}${ok ? '' : `   (wanted ${intent} ${JSON.stringify(slots)})`}`);
}

const friends = [
  { userId: '1', name: 'Ana Cruz', firstName: 'Ana' },
  { userId: '2', name: 'Anna Reyes', firstName: 'Anna' },
  { userId: '3', name: 'Benjamin Lim', firstName: 'Ben' },
  { userId: '4', name: 'Rosa Santos', firstName: 'Rosa' },
] as Friend[];
const checks: [string, boolean][] = [
  ['yes / oo / sige → yes', ['yes', 'Oo', 'sige po', 'go ahead'].every((t) => parseYesNo(t) === 'yes')],
  ['no / hindi / huwag → no', ['no', 'Hindi', 'huwag na', 'cancel'].every((t) => parseYesNo(t) === 'no')],
  ['"Ben" → Benjamin', (matchFriend('Ben', friends) as { friend?: Friend })?.friend?.userId === '3'],
  ['"Tita Rosa" → Rosa', (matchFriend('Tita Rosa', friends) as { friend?: Friend })?.friend?.userId === '4'],
  ['"Ana" → Ana, not Anna (exact wins)', (matchFriend('Ana', friends) as { friend?: Friend })?.friend?.userId === '1'],
  [
    'two friends called Ana → asks which',
    ((matchFriend('Ana', [...friends, { userId: '5', name: 'Ana Reyes', firstName: 'Ana' } as Friend]) as { choices?: Friend[] })
      ?.choices?.length ?? 0) === 2,
  ],
  ['"Zed" → nobody', matchFriend('Zed', friends) === null],
  ['spoken code', parseFriendCode('bee see dee double u two three four five') === 'BCDW-2345'],
  ['code with a 0 is refused', parseFriendCode('ABCD 2340') === null],
  ['after "Hey Accel"', afterWakeWord('Hey Axel, open friends') === 'open friends'],
  // "Hey Accel" as speech recognition writes it — all must wake Accel…
  [
    'wake: accel / axel / axle / excel / accell / aksel / axl / "a cell" / "cell" after hey',
    ['Hey Accel', 'hey axel', 'Hey axle', 'excel', 'Hey Excel!', 'accell', 'aksel', 'Axl', 'hey a cell', 'Hey cell', 'okay Axel', 'hey ax el'].every(
      (t) => findWakeWord(t) !== null,
    ),
  ],
  // …and these must not.
  [
    'no wake: access / excellent / accelerate / excess / "a cell" alone / hello',
    ['access', 'excellent', 'accelerate', 'excess', 'a cell phone', 'hello there', 'also', 'tell me', 'the castle'].every(
      (t) => findWakeWord(t) === null,
    ),
  ],
  ['"hey axle open friends" → "open friends"', afterWakeWord('hey axle open friends') === 'open friends'],
  ['a friend called Axel mid-sentence stays', removeWakeWord('tell Axel I am here') === 'tell Axel I am here'],
  ['"Excel, open friends" → open friends', matchRules('Excel, open friends').intent === 'nav.friends'],
  ['"open axel settings" → Accel settings', matchRules('open axel settings').intent === 'nav.settings_accel'],
  // Strict (the app talking, TalkBack on, inside another mic): only "hey / okay … Accel".
  ['strict: "Axel open friends" alone does not wake', findWakeWord('Axel open friends', { strict: true }) === null],
  ['strict: "hey axel open friends" wakes', afterWakeWord('hey axel open friends', { strict: true }) === 'open friends'],
  ['strict: "I like Excel" is just a sentence', findWakeWord('I like Excel', { strict: true }) === null],
  ['quick reply numbers: "2", "two", "pangalawa", "third" → 2, 2, 2, 3', [parseNumber('2'), parseNumber('two'), parseNumber('pangalawa'), parseNumber('third')].join() === '2,2,2,3'],
];
// The screen registry: the screen in focus is the one asked; leaving removes it.
{
  const entry = (name: string): ScreenEntry => ({ name, describe: () => name, examples: [], commands: { 'conv.my_turn': () => ({ kind: 'say', text: '' }) } });
  const leaveChats = registerScreen(() => entry('Chats'));
  const leaveConversation = registerScreen(() => entry('Conversation mode'));
  checks.push(['registry: the newest screen in focus is the one on screen', currentScreen()?.name === 'Conversation mode']);
  checks.push(['registry: it offers its own commands only', screenOffers('conv.my_turn', {}) && !screenOffers('learn.check', {})]);
  leaveConversation();
  checks.push(['registry: leaving a screen removes its commands', currentScreen()?.name === 'Chats']);
  leaveChats();
  checks.push(['registry: nothing registered → no screen commands', currentScreen() === null && !screenOffers('conv.my_turn', {})]);
}
for (const [name, ok] of checks) {
  if (!ok) failed += 1;
  console.log(`${ok ? '✓' : '✗'} ${name}`);
}
const total = CASES.length + SCREEN_CASES.length + checks.length;
console.log(`\n${total - failed}/${total} passed`);
process.exit(failed ? 1 : 0);
