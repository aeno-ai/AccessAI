// Checks Accel's offline rules (src/accel/rules.ts) and helpers on sample
// sentences — English, Filipino and Taglish.
//   npx tsx scripts/accel-rules-check.ts
import { matchFriend, parseFriendCode, parseYesNo, afterWakeWord } from '../src/accel/language';
import { matchRules } from '../src/accel/rules';
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
];

let failed = 0;
for (const [text, intent, slots = {}] of CASES) {
  const got = matchRules(text);
  const slotsOk = Object.entries(slots).every(([key, value]) => (got.slots as Record<string, string>)[key] === value);
  const ok = got.intent === intent && slotsOk;
  if (!ok) failed += 1;
  console.log(`${ok ? '✓' : '✗'} ${JSON.stringify(text)} → ${got.intent} ${JSON.stringify(got.slots)}${ok ? '' : `   (wanted ${intent} ${JSON.stringify(slots)})`}`);
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
];
for (const [name, ok] of checks) {
  if (!ok) failed += 1;
  console.log(`${ok ? '✓' : '✗'} ${name}`);
}
console.log(`\n${CASES.length + checks.length - failed}/${CASES.length + checks.length} passed`);
process.exit(failed ? 1 : 0);
