/**
 * Accel's offline understanding: plain patterns for common ways of saying
 * each command, in English, Filipino and Taglish. Instant and works with no
 * internet — so the essentials (SOS, going places, reading messages) never
 * depend on the AI server. Only when nothing here is sure does Accel ask
 * the AI (understand.ts).
 *
 * The order matters: specific patterns come before general ones ("SOS
 * settings" must not send an SOS; "open my chat with Ana" isn't just
 * "open chats").
 */
import type { IntentId, Slots } from '@/accel/catalog';
import { normalize, parseFriendCode, stripFillers, WAKE_WORD } from '@/accel/language';

export type Understood = { intent: IntentId; slots: Slots; confidence: number };

type Rule = {
  intent: IntentId;
  /** Tested on the cleaned-up, lower-case sentence. */
  test: RegExp;
  /** Test the whole sentence instead — for rules about Accel itself, whose name is otherwise removed. */
  keepAccel?: boolean;
  confidence?: number;
  /** Pulls details out of the original sentence; returning null skips the rule. */
  slots?: (original: string, match: RegExpMatchArray) => Slots | null;
};

// A name: one word, or an honorific and a word ("Tita Ana").
const NAME = String.raw`((?:ate|kuya|tita|tito|lola|lolo|sir|ma'?am)\s+)?[\p{L}'-]+`;
// The sentence as said (keeping capitals), minus 'Hey Accel' and polite openers.
const LEADING_FILLER = /^(?:\s*(?:please|pls|can you|could you|would you|i want you to|okay|ok|po|uh+|um+)\b[\s,]*)+/i;
const clean = (original: string) => original.replace(WAKE_WORD, ' ').trim().replace(LEADING_FILLER, '').trim();

const nameSlot = (pattern: RegExp) => (original: string): Slots | null => {
  const found = clean(original).match(pattern)?.groups?.name;
  return found ? { friendName: found.replace(/'s$/i, '').trim() } : null;
};

const RULES: Rule[] = [
  // ---- things that must not be mistaken for an SOS
  { intent: 'sos.circle_add', test: /\b(add|put|isama|i-?add)\s+\S+.*\b(to|in|sa)\s+(my\s+)?sos/u, confidence: 0.9,
    slots: nameSlot(new RegExp(String.raw`(?:add|put|isama|i-?add)\s+(?:si\s+)?(?<name>${NAME})\s+(?:to|in|sa)\b`, 'iu')) },
  { intent: 'sos.circle_remove', test: /\b(remove|take|tanggalin|alisin)\s+\S+.*\b(from|out of|sa)\s+(my\s+)?sos/u, confidence: 0.9,
    slots: nameSlot(new RegExp(String.raw`(?:remove|take|tanggalin|alisin)\s+(?:si\s+)?(?<name>${NAME})\s+(?:from|out|sa)\b`, 'iu')) },
  { intent: 'sos.im_safe', test: /\b(i'?m safe|i am safe|safe na ako|ligtas na ako|okay na ako|end (my )?sos|cancel (the )?(sos|emergency)|false alarm|tapusin ang sos)\b/u, confidence: 0.92 },
  { intent: 'nav.settings_sos', test: /\b(sos|emergency)\b.*\bsettings?\b|\bsettings?\b.*\b(sos|emergency)\b|who gets my sos|sos circle|sino makakatanggap/u, confidence: 0.9 },
  { intent: 'nav.emergency_contacts', test: /\bemergency (contacts?|numbers?)\b|mga numero sa emergency/u, confidence: 0.9 },
  { intent: 'nav.accel_guide', test: /\b(accel guide|the guide|show me what you can do|list of commands)\b/u, confidence: 0.9, keepAccel: true },
  { intent: 'nav.settings_accel', test: /\b(accel|assistant)\b.*\bsettings?\b|\bsettings?\b.*\b(accel|assistant)\b|turn off hey accel/u, confidence: 0.9, keepAccel: true },
  // Just "help" is the guide; "help me…" is an SOS (below).
  { intent: 'read.help', test: /^help$|^(what can (i|you) (say|do|ask)|commands|how (do i|to) use (you|this|accel)|ano(ng| ang)? pwede|ano kaya mong gawin|tulungan mo ako gamitin)\b/u, confidence: 0.9 },

  // ---- emergency
  { intent: 'sos.send', test: /\b(sos|emergency|emerhensya|saklolo|tulong|tulungan (mo|nyo|niyo) ako|i need help|help me|call for help|i'?m in danger|in danger|nasa panganib)\b/u, confidence: 0.92 },

  // ---- messages and friends (with details)
  { intent: 'msg.send', test: /^(tell|message|text|send|i-?message|sabihin|pakisabi|pasabi)\b/u, confidence: 0.9,
    slots: (original) => {
      const sentence = clean(original);
      const patterns = [
        new RegExp(String.raw`^(?:tell|message|text)\s+(?<name>${NAME})\s+(?:that\s+|saying\s+|:\s*)?(?<msg>.+)$`, 'iu'),
        new RegExp(String.raw`^send\s+(?<name>${NAME})\s+a\s+message\s+(?:saying\s+|that\s+|:\s*)?(?<msg>.+)$`, 'iu'),
        new RegExp(String.raw`^send\s+a\s+message\s+to\s+(?<name>${NAME})\s*(?:saying\s+|that\s+|:\s*)?(?<msg>.+)$`, 'iu'),
        new RegExp(String.raw`^(?:i-?message|i-?text)\s+(?:si\s+)?(?<name>${NAME})\s+(?:na\s+|ng\s+)?(?<msg>.+)$`, 'iu'),
        new RegExp(String.raw`^(?:sabihin\s+(?:mo\s+)?|pakisabi\s+|pasabi\s+)(?:kay|kina)\s+(?<name>${NAME})\s+(?:na\s+)?(?<msg>.+)$`, 'iu'),
      ];
      for (const pattern of patterns) {
        const groups = sentence.match(pattern)?.groups;
        if (groups?.name && groups.msg) return { friendName: groups.name.trim(), messageText: groups.msg.trim() };
      }
      return null;
    } },
  { intent: 'read.last_message_from', test: /\b(what did \S+ (just )?(say|tell me|send)|read \S+ last message|last message (from|of|ni) \S+|sabi ni|sinabi ni|message ni)\b/u, confidence: 0.88,
    slots: (original) => {
      const sentence = clean(original);
      const patterns = [
        new RegExp(String.raw`what did\s+(?<name>${NAME})\s+(?:just\s+)?(?:say|tell|send)`, 'iu'),
        new RegExp(String.raw`read\s+(?<name>${NAME})(?:'s)?\s+last`, 'iu'),
        new RegExp(String.raw`last message (?:from|of|ni)\s+(?<name>${NAME})`, 'iu'),
        new RegExp(String.raw`(?:sabi|sinabi|message)\s+ni\s+(?<name>${NAME})`, 'iu'),
      ];
      for (const pattern of patterns) {
        const name = sentence.match(pattern)?.groups?.name;
        if (name) return { friendName: name.replace(/'s$/i, '').trim() };
      }
      return null;
    } },
  { intent: 'nav.chat_with', test: /\b(chat|conversation|usapan|kausapin)\b.*\b(with|namin ni|ni|kay|si)\b|\b(chat with|i-?chat)\b/u, confidence: 0.88,
    slots: (original) => {
      const sentence = clean(original);
      const name = sentence.match(new RegExp(String.raw`(?:with|namin ni|ni|kay|si|chat)\s+(?<name>${NAME})\s*(?:'s)?\s*(?:chat)?\s*$`, 'iu'))?.groups?.name;
      return name && !/^(me|my|someone|a|the)$/i.test(name) ? { friendName: name.trim() } : null;
    } },
  { intent: 'friend.add_code', test: /\b(friend code|add (the )?code|code is|i-?add ang code|code)\b.*[a-z0-9]/u, confidence: 0.9,
    slots: (original) => {
      const code = parseFriendCode(clean(original).replace(/^.*?\bcode\b/i, ''));
      return code ? { friendCode: code } : null;
    } },
  { intent: 'friend.decline_request', test: /\b(decline|reject|ignore|i-?decline|huwag tanggapin)\b/u, confidence: 0.88,
    slots: (original) => {
      const name = original.match(new RegExp(String.raw`(?:decline|reject|ignore|i-?decline)\s+(?:the\s+request\s+(?:of|from)\s+|si\s+)?(?<name>${NAME})`, 'iu'))?.groups?.name;
      return name && !/^(the|that|request|friend|ang)$/i.test(name) ? { friendName: name.replace(/'s$/i, '') } : {};
    } },
  { intent: 'friend.accept_request', test: /\b(accept|tanggapin|i-?accept)\b/u, confidence: 0.88,
    slots: (original) => {
      const name = original.match(new RegExp(String.raw`(?:accept|i-?accept|tanggapin)\s+(?:the\s+request\s+(?:of|from)\s+|si\s+|ang request ni\s+)?(?<name>${NAME})`, 'iu'))?.groups?.name;
      return name && !/^(the|that|request|friend|ang)$/i.test(name) ? { friendName: name.replace(/'s$/i, '') } : {};
    } },

  // ---- never by voice
  { intent: 'blocked.account', test: /\b(delete|erase|burahin).*\baccount\b|\blog ?out\b|\bsign (me )?out\b|mag-?logout|\bunfriend\b|remove \S+ as (a )?friend|change (my )?password/u, confidence: 0.95 },

  // ---- voice and text size
  { intent: 'voice.change', test: /\b(voice|boses)\b/u, confidence: 0.86,
    slots: (original) => {
      const said = normalize(original);
      if (/\b(man|man's|mans|male|lalaki|guy)\b/.test(said)) return { value: 'man' };
      if (/\b(woman|woman's|womans|female|babae|girl|lady)\b/.test(said)) return { value: 'woman' };
      if (/\b(default|normal|automatic|auto)\b/.test(said)) return { value: 'auto' };
      return null;
    } },
  { intent: 'speech.slower', test: /\b(too fast|slow(er)? down|speak slower|talk slower|slower|dahan-?dahan|bagalan|mabagal lang|masyadong mabilis)\b/u, confidence: 0.9 },
  { intent: 'speech.faster', test: /\b(too slow|speed up|speak faster|talk faster|faster|bilisan|mas mabilis|masyadong mabagal)\b/u, confidence: 0.9 },
  { intent: 'text.bigger', test: /\b(bigger|larger|increase|palakihin|zoom in)\b.*\b(text|font|letters|words|sulat)\b|\b(text|font|letters|words|sulat)\b.*\b(too small|bigger|maliit)\b|can'?t (read|see) (it|the words)|ang liit ng sulat/u, confidence: 0.9 },
  { intent: 'text.smaller', test: /\b(smaller|decrease|liitan|zoom out)\b.*\b(text|font|letters|words|sulat)\b|\b(text|font|letters|words|sulat)\b.*\b(too big|huge|malaki)\b|ang laki ng sulat/u, confidence: 0.9 },

  // ---- reading things aloud
  { intent: 'read.where_am_i', test: /\b(where am i|what (screen|page) (is this|am i (on|in))|nasaan ako|anong screen)\b/u, confidence: 0.92 },
  { intent: 'read.repeat', test: /^(repeat|say (that|it) again|again|one more time|ulitin|pakiulit|ano ulit|ulit)\b/u, confidence: 0.9 },
  { intent: 'read.my_friend_code', test: /\b(my (friend )?code|friend code ko|code ko|my qr)\b/u, confidence: 0.9 },
  { intent: 'nav.friend_requests', test: /\b(open|show|go to|buksan|punta)\b.*\brequests?\b/u, confidence: 0.88 },
  { intent: 'read.friend_requests', test: /\b(friend requests?|requests?)\b|who (wants to be|added) (my friend|me)|sino (ang )?nag-?(add|request)/u, confidence: 0.86 },
  { intent: 'read.who_online', test: /\b(who'?s|who is|sino( ang)?|is anyone|anyone)\b.*\bonline\b/u, confidence: 0.9 },
  { intent: 'read.new_messages', test: /\b(new|unread|bagong)\b.*\b(messages?|texts?|chats?)\b|\b(any|may|did i get|do i have)\b.*\b(messages?|texts?|nag-?text|nag-?message|nag-?chat)\b|who messaged me|check (my )?messages|has anyone messaged me/u, confidence: 0.88 },

  // ---- going places (most specific first)
  { intent: 'nav.settings_needs', test: /\b(my needs|profile type|accessibility profile|disability)\b/u, confidence: 0.9 },
  { intent: 'nav.settings_display', test: /\b(display|colou?rs?|contrast|dark mode|kulay)\b/u, confidence: 0.86 },
  { intent: 'nav.settings_speech', test: /\b(speech|voice|read aloud|boses|text to speech)\b.*\bsettings?\b|settings? ng boses/u, confidence: 0.88 },
  { intent: 'nav.settings_alerts', test: /\b(alerts?|vibrat\w*|flash|notifications?)\b.*\bsettings?\b/u, confidence: 0.88 },
  { intent: 'nav.settings', test: /\b(settings?|preferences)\b/u, confidence: 0.86 },
  { intent: 'nav.add_friend', test: /\b(add|new|magdagdag|mag-?add)\b.*\b(friends?|kaibigan)\b|\bscan\b.*\bqr\b/u, confidence: 0.88 },
  { intent: 'nav.friends', test: /\b(friends?|kaibigan)\b/u, confidence: 0.82 },
  { intent: 'nav.chats', test: /\b(chats?|chat history|saved conversations|past conversations|old conversations|mga dati)\b/u, confidence: 0.82 },
  // "co…ation" also catches how speech recognition sometimes spells
  // conversation ("coversation", "converstation").
  { intent: 'nav.conversation', test: /\b(co\w{2,8}ation|convo|talk|usap|makipag-?usap|kausap\w*|speak (with|to)|deaf|bingi)\b/u, confidence: 0.86 },
  { intent: 'nav.learn', test: /\b(learn|tutorials?|lessons?|paano gamitin)\b/u, confidence: 0.86 },
  { intent: 'nav.profile', test: /\b(profile|my name|pangalan ko|account details)\b/u, confidence: 0.86 },
  { intent: 'nav.home', test: /\b(home|main (menu|screen)|dashboard|simula|umpisa)\b/u, confidence: 0.86 },
  { intent: 'nav.back', test: /^(go back|back|previous( screen)?|return|bumalik|balik|atras)\b/u, confidence: 0.9 },
];

/** The phone's own guess at what was meant (confidence 0 = no idea). */
export function matchRules(text: string): Understood {
  const said = stripFillers(text);
  if (!said) return { intent: 'none', slots: {}, confidence: 0 };
  const whole = normalize(text);
  for (const rule of RULES) {
    const match = (rule.keepAccel ? whole : said).match(rule.test);
    if (!match) continue;
    const slots = rule.slots ? rule.slots(text, match) : {};
    if (slots === null) continue; // pattern fit, but the details didn't — try the next rule
    return { intent: rule.intent, slots, confidence: rule.confidence ?? 0.85 };
  }
  return { intent: 'none', slots: {}, confidence: 0 };
}
