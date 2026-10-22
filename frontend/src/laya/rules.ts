/**
 * Laya's offline understanding: plain patterns for common ways of saying
 * each command, in English, Filipino and Taglish. Instant and works with no
 * internet — so the essentials (SOS, going places, reading messages) never
 * depend on the AI server. Only when nothing here is sure does Laya ask
 * the AI (understand.ts).
 *
 * The order matters: specific patterns come before general ones ("SOS
 * settings" must not send an SOS; "open my chat with Ana" isn't just
 * "open chats").
 */
import type { IntentId, Slots } from '@/laya/catalog';
import { normalize, parseFriendCode, removeWakeWord, spellLaya, stripFillers } from '@/laya/language';

export type Understood = { intent: IntentId; slots: Slots; confidence: number };

type Rule = {
  intent: IntentId;
  /** Tested on the cleaned-up, lower-case sentence. */
  test: RegExp;
  /** Test the whole sentence instead — for rules about Laya itself, whose name is otherwise removed. */
  keepLaya?: boolean;
  confidence?: number;
  /** Pulls details out of the original sentence; returning null skips the rule. */
  slots?: (original: string, match: RegExpMatchArray) => Slots | null;
  /**
   * A screen rule that means nothing elsewhere ("continue", "open Ate
   * Lyka"): off its screen it's not even a guess.
   */
  hereOnly?: boolean;
};


// A name: one word, or an honorific and a word ("Tita Ana").
const NAME = String.raw`((?:ate|kuya|tita|tito|lola|lolo|sir|ma'?am)\s+)?[\p{L}'-]+`;
// The sentence as said (keeping capitals), minus 'Hey Laya' and polite openers.
const LEADING_FILLER = /^(?:\s*(?:please|pls|can you|could you|would you|i want you to|okay|ok|po|uh+|um+)\b[\s,]*)+/i;
const clean = (original: string) => removeWakeWord(original).replace(LEADING_FILLER, '').trim();

const nameSlot = (pattern: RegExp) => (original: string): Slots | null => {
  const found = clean(original).match(pattern)?.groups?.name;
  return found ? { friendName: found.replace(/'s$/i, '').trim() } : null;
};

// Like nameSlot, but the name is optional: inside a friend's chat "read the
// messages" means that friend.
const optionalName = (...patterns: RegExp[]) => (original: string): Slots => {
  const sentence = clean(original);
  for (const pattern of patterns) {
    const found = sentence.match(pattern)?.groups?.name;
    if (found && !/^(me|my|the|a|this|it|our|us)$/i.test(found)) return { friendName: found.replace(/'s$/i, '').trim() };
  }
  return {};
};

// "text bigger please" is about the screen, not a message to someone called Bigger.
const NOT_A_NAME = /^(bigger|smaller|larger|size|font|me|the|a|an|my|it|this|that|please)$/i;

// Big text: "show big text I need to pee", "ipakita nang malaki: kailangan kong mag-CR".
const BIG_TEXT_WITH_WORDS = [
  /^(?:show|display|put)\s+(?:it\s+|this\s+)?(?:in\s+)?(?:big|large|huge)\s+(?:text|letters)\s*[:,]?\s*(?<text>\S.*)$/iu,
  /^big\s+text\s*[:,]?\s+(?<text>\S.*)$/iu,
  /^(?:ipakita|pakita)(?:\s+mo)?\s+(?:nang\s+malaki|sa\s+malaking\s+(?:sulat|letra))\s*[:,]?\s*(?<text>\S.*)$/iu,
  /^malaking\s+sulat\s*[:,]?\s*(?<text>\S.*)$/iu,
];
const bigTextWords = (original: string): Slots | null => {
  const sentence = clean(original);
  for (const pattern of BIG_TEXT_WITH_WORDS) {
    const text = sentence.match(pattern)?.groups?.text?.trim();
    if (text) return { messageText: text.slice(0, 300) };
  }
  return null;
};

const RULES: Rule[] = [
  // ---- "Papasa ba kami?" (the thesis defense joke): before anything else
  { intent: 'fun.papasa', test: /\b(?:papasa|pasado|makakapasa|makapasa)\s+(?:ba\s+)?(?:kami|tayo)\b|\b(?:kami|tayo)\s+(?:ba\s+)?(?:ay\s+)?(?:papasa|pasado|makakapasa)\b|\b(?:will|are|do you think|think)\s+we\s+(?:going to\s+|gonna\s+|will\s+)?pass\b/u, confidence: 0.95 },

  // ---- Big text first: "show big text help me" shows the words, it isn't an SOS
  { intent: 'text.show_big', test: /^(?:show|display|put)\s+(?:it\s+|this\s+)?(?:in\s+)?(?:big|large|huge)\s+(?:text|letters)\s+\S|^big text\s+\S|^(?:ipakita|pakita)(?: mo)?\s+(?:nang\s+malaki|sa\s+malaking\s+(?:sulat|letra))\s+\S|^malaking sulat\s+\S/u, confidence: 0.92,
    slots: bigTextWords },
  { intent: 'nav.big_text', test: /^(?:open|show|go to|buksan|punta sa)?\s*(?:the\s+|ang\s+)?(?:big text|malaking sulat)$/u, confidence: 0.92 },

  // ---- things that must not be mistaken for an SOS
  { intent: 'read.recent_sos', test: /\b(?:who|sino)\b.*\b(?:sent|send|nag-?sos|nag-?send)\b.*\bsos\b|\bsino (?:ang )?nag-?sos\b|\brecent sos\b|\bsos (?:history|lately|recently)\b|\b(?:any|was there an?|were there) sos\b.*\b(?:lately|recently|today|yesterday|this week)\b|\b(?:my |the )?last sos\b/u, confidence: 0.9 },
  { intent: 'sos.circle_add', test: /\b(add|put|isama|i-?add)\s+\S+.*\b(to|in|sa)\s+(my\s+)?sos/u, confidence: 0.9,
    slots: nameSlot(new RegExp(String.raw`(?:add|put|isama|i-?add)\s+(?:si\s+)?(?<name>${NAME})\s+(?:to|in|sa)\b`, 'iu')) },
  { intent: 'sos.circle_remove', test: /\b(remove|take|tanggalin|alisin)\s+\S+.*\b(from|out of|sa)\s+(my\s+)?sos/u, confidence: 0.9,
    slots: nameSlot(new RegExp(String.raw`(?:remove|take|tanggalin|alisin)\s+(?:si\s+)?(?<name>${NAME})\s+(?:from|out|sa)\b`, 'iu')) },
  { intent: 'sos.im_safe', test: /\b(i'?m safe|i am safe|safe na ako|ligtas na ako|okay na ako|end (my )?sos|cancel (the )?(sos|emergency)|false alarm|tapusin ang sos)\b/u, confidence: 0.92 },
  { intent: 'nav.settings_sos', test: /\b(sos|emergency)\b.*\bsettings?\b|\bsettings?\b.*\b(sos|emergency)\b|who gets my sos|sos circle|sino (?:ang )?makakatanggap/u, confidence: 0.9 },
  { intent: 'nav.emergency_contacts', test: /\bemergency (contacts?|numbers?)\b|mga numero sa emergency/u, confidence: 0.9 },
  { intent: 'nav.laya_guide', test: /\b(laya guide|the guide|show me what you can do|list of commands|gabay ni laya)\b|\bipakita (?:mo )?(?:ang )?lahat ng kaya mo/u, confidence: 0.9, keepLaya: true },
  { intent: 'nav.settings_laya', test: /\b(laya|assistant)\b.*\bsettings?\b|\bsettings?\b.*\b(laya|assistant)\b|turn off hey laya/u, confidence: 0.9, keepLaya: true },
  // Just "help" is the guide; "help me…" is an SOS (below).
  { intent: 'read.help', test: /^help$|^(what can (i|you) (say|do|ask)|commands|how (do i|to) use (you|this|laya)|ano'?(ng| ang)? pwede|ano kaya mong gawin|tulungan mo ako gamitin)\b/u, confidence: 0.9 },

  // ---- emergency
  { intent: 'sos.send', test: /\b(sos|emergency|emerhensya|saklolo|tulong|tulungan (mo|nyo|niyo) ako|i need help|help me|call for help|call 911|call (an )?ambulance|call the police|i'?m in danger|in danger|nasa panganib)\b/u, confidence: 0.92 },

  // ---- Conversation mode: a new one (named), or the last one
  // "Start a conversation with Ana" stays a chat with a friend (below).
  { intent: 'nav.last_conversation', test: /\b(?:open|continue|resume|go back to|back to|buksan|ituloy|balikan)\b.*\b(?:last|latest|previous|recent|huling|dating)\b.*\b(?:conversation|convo|usapan)\b|^(?:my |the )?last conversation$/u, confidence: 0.9 },
  { intent: 'conv.start', test: /\b(?:start|begin|make|create|new|bagong|gumawa ng)\b.*\b(?:conversation|convo|usapan)\b(?!.*\b(?:with|kasama|namin ni|ni|kay)\b)/u, confidence: 0.88,
    slots: (original) => {
      const name = clean(original).match(/\b(?:called|named|titled|na tinatawag na|na pangalan ay)\s+(?<name>.+)$/iu)?.groups?.name;
      return name ? { friendName: name.replace(/[.!?]+$/, '').trim() } : {};
    } },

  // ---- messages and friends (with details)
  { intent: 'msg.send', test: /^(tell|message|text|send|i-?message|mag-?message|sabihin|pakisabi|pasabi)\b/u, confidence: 0.9,
    slots: (original) => {
      const sentence = clean(original);
      const patterns = [
        new RegExp(String.raw`^(?:tell|message|text)\s+(?<name>${NAME})\s+(?:that\s+|saying\s+|:\s*)?(?<msg>.+)$`, 'iu'),
        new RegExp(String.raw`^send\s+(?<name>${NAME})\s+a\s+message\s+(?:saying\s+|that\s+|:\s*)?(?<msg>.+)$`, 'iu'),
        new RegExp(String.raw`^send\s+a\s+message\s+to\s+(?<name>${NAME})(?:\s*:\s*|\s+(?:saying\s+|that\s+)?)(?<msg>.+)$`, 'iu'),
        new RegExp(String.raw`^(?:i-?message|i-?text)\s+(?:si\s+)?(?<name>${NAME})\s+(?:na\s+|ng\s+)?(?<msg>.+)$`, 'iu'),
        new RegExp(String.raw`^(?:sabihin\s+(?:mo\s+)?|pakisabi\s+|pasabi\s+)(?:kay|kina)\s+(?<name>${NAME})\s+(?:na\s+)?(?<msg>.+)$`, 'iu'),
      ];
      for (const pattern of patterns) {
        const groups = sentence.match(pattern)?.groups;
        if (groups?.name && groups.msg && !NOT_A_NAME.test(groups.name.trim())) {
          return { friendName: groups.name.trim(), messageText: groups.msg.trim() };
        }
      }
      // Who, but not what yet — Laya asks for the words. These need the
      // word "message", so "text bigger" still means bigger text.
      const partial = [
        new RegExp(String.raw`^send\s+(?:a\s+)?message\s+to\s+(?<name>${NAME})$`, 'iu'),
        new RegExp(String.raw`^send\s+(?<name>${NAME})\s+a\s+message$`, 'iu'),
        new RegExp(String.raw`^message\s+(?<name>${NAME})$`, 'iu'),
        new RegExp(String.raw`^(?:mag-?message|i-?message)\s+(?:kay|kina|si)\s+(?<name>${NAME})$`, 'iu'),
      ];
      for (const pattern of partial) {
        const name = sentence.match(pattern)?.groups?.name;
        if (name && !NOT_A_NAME.test(name.trim())) return { friendName: name.trim() };
      }
      // "send a message" — Laya asks who.
      if (/^(?:send|write)\s+a\s+message$|^mag-?message$/iu.test(sentence)) return {};
      // Inside a chat: "send I'm outside".
      const words = sentence.match(/^send\s+(?!(?:a|an|the|my|friend|code|sos)\b)(?<msg>.+)$/iu)?.groups?.msg;
      return words ? { messageText: words.trim() } : null;
    } },
  { intent: 'msg.reply', test: /^(reply|respond|sagutin|i-?reply|replyan)\b/u, confidence: 0.9,
    slots: (original) => {
      const sentence = clean(original);
      const patterns = [
        new RegExp(String.raw`^(?:reply|respond)\s+to\s+(?<name>${NAME})\s*(?:saying\s+|that\s+|with\s+|:\s*)?(?<msg>.*)$`, 'iu'),
        new RegExp(String.raw`^(?:sagutin|i-?reply|replyan)\s+(?:si|kay)\s+(?<name>${NAME})\s*(?:ng\s+|na\s+)?(?<msg>.*)$`, 'iu'),
        new RegExp(String.raw`^(?:reply|respond|sagutin|i-?reply|replyan)\s*(?:saying\s+|that\s+|with\s+|:\s*)?(?<msg>.*)$`, 'iu'),
      ];
      for (const pattern of patterns) {
        const groups = sentence.match(pattern)?.groups;
        if (!groups) continue;
        const result: Slots = {};
        if (groups.name) result.friendName = groups.name.trim();
        if (groups.msg?.trim()) result.messageText = groups.msg.trim();
        return result;
      }
      return {};
    } },
  // "my last message" before "Ana's last message"; "previous message" (mine) before "previous messages" (older).
  { intent: 'read.my_last_message', test: /\b(my (last|previous|latest) (message|text)|what did i (say|send|tell)|huling (message|sinabi) ko)\b/u, confidence: 0.9,
    slots: optionalName(
      new RegExp(String.raw`(?:to|kay|for)\s+(?<name>${NAME})\s*\??$`, 'iu'),
    ) },
  { intent: 'read.older_messages', test: /\b(older|previous|earlier|more|naunang|lumang|dating)\s+(messages?|texts?|chats?)\b|^(read|hear) (more|older|earlier)\b/u, confidence: 0.9,
    slots: optionalName(
      new RegExp(String.raw`(?:with|from|ni|kay)\s+(?<name>${NAME})\s*$`, 'iu'),
    ) },
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
  // Reading a chat aloud ("read my chat with Ana", "read the messages" inside one).
  { intent: 'read.chat_with',
    test: /^(?!.*\b(new|unread|bagong|last|latest|huling)\b)(read|basahin|hear)\b.*\b(chat|messages?|conversation|usapan|convo)\b|what did \S+ and i (talk|chat) about|what did we (talk|chat) about|ano (ang )?(pinag-?usapan|usapan) (namin|natin)/u,
    confidence: 0.9,
    slots: optionalName(
      new RegExp(String.raw`(?:with|namin ni|natin ni|ni|kay)\s+(?<name>${NAME})\s*$`, 'iu'),
      new RegExp(String.raw`what did\s+(?<name>${NAME})\s+and\s+i\b`, 'iu'),
      new RegExp(String.raw`(?:read|basahin|hear)\s+(?<name>${NAME})'s\s+(?:chat|messages?|conversation)`, 'iu'),
    ) },
  { intent: 'nav.chat_with', test: /\b(chat|conversation|usapan|kausapin)\b.*\b(with|namin ni|ni|kay|si)\b|\b(chat with|i-?chat)\b|\b(open|go to|buksan)\s+[\p{L}-]+'s\s+(chat|conversation|convo|messages)\b/u, confidence: 0.88,
    slots: (original) => {
      const sentence = clean(original);
      const possessive = sentence.match(new RegExp(String.raw`(?:open|go to|buksan)\s+(?<name>${NAME})'s\s+(?:chat|conversation|convo|messages)`, 'iu'))?.groups?.name;
      if (possessive && !/^(me|my|someone|a|the)$/i.test(possessive)) return { friendName: possessive.replace(/'s$/i, '').trim() };
      const name = sentence.match(new RegExp(String.raw`(?:with|namin ni|ni|kay|si|chat)\s+(?<name>${NAME})\s*(?:'s)?\s*(?:chat)?\s*$`, 'iu'))?.groups?.name;
      return name && !/^(me|my|someone|a|the)$/i.test(name) ? { friendName: name.trim() } : null;
    } },
  { intent: 'friend.add_code', test: /\b(friend code|add (the )?code|code is|i-?add ang code|code)\b.*[a-z0-9]/u, confidence: 0.9,
    slots: (original) => {
      const code = parseFriendCode(clean(original).replace(/^.*?\bcode\b/i, ''));
      return code ? { friendCode: code } : null;
    } },
  { intent: 'friend.decline_request', test: /\b(decline|reject|ignore|i-?decline|huwag tanggapin|tanggihan)\b/u, confidence: 0.88,
    slots: (original) => {
      const name = original.match(new RegExp(String.raw`(?:decline|reject|ignore|i-?decline|tanggihan)\s+(?:the\s+request\s+(?:of|from)\s+|si\s+|ang request ni\s+)?(?<name>${NAME})`, 'iu'))?.groups?.name;
      return name && !/^(the|that|request|friend|ang)$/i.test(name) ? { friendName: name.replace(/'s$/i, '') } : {};
    } },
  { intent: 'friend.accept_request', test: /\b(accept|tanggapin|i-?accept)\b/u, confidence: 0.88,
    slots: (original) => {
      const name = original.match(new RegExp(String.raw`(?:accept|i-?accept|tanggapin)\s+(?:the\s+request\s+(?:of|from)\s+|si\s+|ang request ni\s+)?(?<name>${NAME})`, 'iu'))?.groups?.name;
      return name && !/^(the|that|request|friend|ang)$/i.test(name) ? { friendName: name.replace(/'s$/i, '') } : {};
    } },

  // ---- never by voice
  { intent: 'blocked.account', test: /\b(delete|erase|burahin).*\baccount\b|\blog ?out\b|\bsign (me )?out\b|mag-?logout|\bunfriend\b|remove \S+ as (a )?friend|change (my )?(password|email)/u, confidence: 0.95 },

  // ---- outside AccessAI: other apps, phone settings, calls (other than SOS), the web
  { intent: 'blocked.outside', test: /\b(?:open|launch|go to|buksan|start)\s+(?:facebook|fb|messenger|youtube|tiktok|instagram|google|chrome|spotify|gmail|twitter|viber|whatsapp|telegram|shopee|lazada|grab|the camera app|gallery|photos|phone settings|my phone settings|the settings app)\b|\b(?:call|tawagan|pakitawagan|tawagan mo|dial|i-?call|ring)\s+(?!for\b|911\b|an? ambulance\b|the police\b)\S+|\bturn (?:on|off) (?:the |my )?(?:wi-?fi|bluetooth|flashlight|mobile data|data|hotspot|airplane mode|location|gps)\b|\b(?:search|google|look up|i-?search)\b.*\b(?:google|the web|online|internet)\b|\bplay (?:some |a )?(?:music|song|songs|video|videos)\b|\bset (?:an? )?(?:alarm|timer|reminder)\b|\border (?:some |a )?(?:food|pizza|grab)\b/u, confidence: 0.9 },

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
  { intent: 'text.smaller', test: /\b(smaller|decrease|liitan|paliitin|zoom out)\b.*\b(text|font|letters|words|sulat)\b|\b(text|font|letters|words|sulat)\b.*\b(too big|huge|malaki|smaller)\b|ang laki ng sulat/u, confidence: 0.9 },

  // ---- reading things aloud
  { intent: 'read.screen', test: /\b(?:what'?s|what is) (?:on )?(?:this|the) (?:screen|page)\b|\bdescribe (?:this|the) (?:screen|page)\b|^what'?s here$|\bwhat (?:do|can) (?:i|you) see\b|\bano'?n?g? nandito\b|\bano (?:ang )?(?:nasa|meron sa) screen\b|\bread (?:the|this) (?:screen|page)\b/u, confidence: 0.92 },
  { intent: 'read.where_am_i', test: /\b(where am i|what (screen|page) (is this|am i (on|in))|nasaan ako|anong screen)\b/u, confidence: 0.92 },
  { intent: 'read.repeat', test: /^(repeat|say (that|it) again|again|one more time|ulitin|pakiulit|ano ulit|ulit)\b/u, confidence: 0.9 },
  { intent: 'read.my_friend_code', test: /\b(my (friend )?code|friend code ko|code ko|my qr)\b/u, confidence: 0.9 },
  { intent: 'nav.friend_requests', test: /\b(open|show|go to|buksan|punta)\b.*\brequests?\b/u, confidence: 0.88 },
  { intent: 'read.friend_requests', test: /\b(friend requests?|requests?)\b|who (wants to be|added) (my friend|me)|sino (ang )?nag-?(add|request)/u, confidence: 0.86 },
  { intent: 'read.who_online', test: /\b(who'?s|who is|sino( ang)?|is anyone|anyone)\b.*\bonline\b/u, confidence: 0.9 },
  { intent: 'read.new_messages', test: /\b(new|unread|bagong)\b.*\b(messages?|texts?|chats?)\b|\b(any|may|did i get|do i have)\b.*\b(messages?|texts?|nag-?text|nag-?message|nag-?chat)\b|who messaged me|check (my )?messages|has anyone messaged me/u, confidence: 0.88 },

  // ---- going places (most specific first)
  { intent: 'learn.next_lesson', test: /\b(?:next|start|begin|continue|resume|simulan|ituloy)\b.*\b(?:lesson|level|aralin)\b|\bnext lesson\b/u, confidence: 0.9 },
  // "Learn ASL", "switch to FSL", "matuto ng American Sign Language" (before the general nav.learn below)
  { intent: 'learn.language', test: /\b(?:learn|study|switch(?: learn(?:ing)?)? to|change(?: learn(?:ing)?)?(?: language)? to|use|matuto(?: ng)?|mag-?aral(?: ng)?|pag-?aralan|aralin|lipat sa|palitan sa)\b.*\b(?:asl|fsl|american sign(?: language)?|filipino sign(?: language)?)\b|^(?:asl|fsl)(?: please| po)?$/u, confidence: 0.92,
    slots: (original) => ({ value: /\b(?:asl|american)\b/i.test(original) ? 'asl' : 'fsl' }) },
  { intent: 'learn.practice', test: /\b(?:sign practice|practi[sc]e (?:mode|signs|screen|page)|open practi[sc]e|mag-?practi[sc]e (?:ng )?signs?)\b/u, confidence: 0.9 },
  // The camera that reads signs and says them out loud (Home's Sign language card).
  { intent: 'nav.sign_camera', test: /\bsign(?:ing)?(?: language)? camera\b|\bcamera (?:for|ng|sa) sign/u, confidence: 0.9 },
  { intent: 'nav.settings_needs', test: /\b(my needs|profile type|accessibility profile|disability)\b/u, confidence: 0.9 },
  { intent: 'nav.settings_display', test: /\b(display|colou?rs?|contrast|dark mode|kulay)\b/u, confidence: 0.86 },
  { intent: 'nav.settings_speech', test: /\b(speech|voice|read aloud|boses|text to speech)\b.*\bsettings?\b|settings? ng boses/u, confidence: 0.88 },
  { intent: 'nav.settings_alerts', test: /\b(alerts?|vibrat\w*|flash|notifications?)\b.*\bsettings?\b|\bsettings? ng (alerts?|vibrat\w*|notifications?)\b/u, confidence: 0.88 },
  { intent: 'nav.settings', test: /\b(settings?|preferences)\b/u, confidence: 0.86 },
  { intent: 'nav.add_friend', test: /\b(add|new|magdagdag|mag-?add)\b.*\b(friends?|kaibigan)\b|\bscan\b.*\bqr\b/u, confidence: 0.88 },
  { intent: 'nav.friends', test: /\b(friends?|kaibigan)\b/u, confidence: 0.82 },
  { intent: 'nav.chats', test: /\b(chats?|chat history|saved conversations|past conversations|old conversations|mga dati)\b/u, confidence: 0.82 },
  // "co…ation" also catches how speech recognition sometimes spells
  // conversation ("coversation", "converstation").
  { intent: 'nav.conversation', test: /\b(co\w{2,8}ation|convo|talk|usap|makipag-?usap|kausap\w*|speak (with|to)|deaf|bingi)\b/u, confidence: 0.86 },
  // Learn is the sign-language course.
  { intent: 'nav.learn', test: /\b(learn|lessons?|tutorials?|matuto|mag-?aral|practi[sc]e)\b/u, confidence: 0.86 },
  { intent: 'nav.profile', test: /\b(profile|my name|pangalan ko|account details)\b/u, confidence: 0.86 },
  { intent: 'nav.home', test: /\b(home|main (menu|screen)|dashboard|simula|umpisa)\b/u, confidence: 0.86 },
  { intent: 'nav.back', test: /^(go back|back|previous( screen)?|return|bumalik|balik|atras)\b/u, confidence: 0.9 },
  // Last: any other "ipakita …" is probably words to show big ("ipakita:
  // salamat po") — only a guess, so the AI decides when online.
  { intent: 'text.show_big', test: /^(?:ipakita|pakita)(?: mo)?\s+\S/u, confidence: 0.75,
    slots: (original) => {
      const text = clean(original).replace(/^(?:ipakita|pakita)(?:\s+mo)?\s*[:,]?\s*/iu, '').trim();
      return text ? { messageText: text.slice(0, 300) } : null;
    } },
];

// "The second one", "quick reply 3", "pangalawa" → 2.
const NUMBER_WORDS: [RegExp, number][] = [
  [/^(1|1st|one|first|una|isa|pang-?isa)$/, 1],
  [/^(2|2nd|two|second|dalawa|pangalawa|ikalawa)$/, 2],
  [/^(3|3rd|three|third|tatlo|pangatlo|ikatlo)$/, 3],
  [/^(4|4th|four|fourth|apat|pang-?apat|ika-?apat)$/, 4],
  [/^(5|5th|five|fifth|lima|panglima|ikalima)$/, 5],
  [/^(6|6th|six|sixth|anim|pang-?anim)$/, 6],
  [/^(7|7th|seven|seventh|pito|pampito)$/, 7],
  [/^(8|8th|eight|eighth|walo|pangwalo)$/, 8],
  [/^(9|9th|nine|ninth|siyam|pansiyam)$/, 9],
  [/^(10|10th|ten|tenth|sampu|pansampu)$/, 10],
];
export function parseNumber(word: string | undefined): number | null {
  if (!word) return null;
  // "pangalawang", "unang": the linker -ng joined to the number.
  const bare = word.trim().replace(/(?<=[aeiou])ng$/, '');
  const found = NUMBER_WORDS.find(([pattern]) => pattern.test(word.trim()) || pattern.test(bare));
  if (found) return found[1];
  const digits = Number(word);
  return Number.isInteger(digits) && digits > 0 && digits <= 20 ? digits : null;
}

const ORDINAL = String.raw`(?:first|second|third|fourth|fifth|1st|2nd|3rd|4th|5th|una|pangalawa|ikalawa|pangatlo|ikatlo|pang-?apat|ika-?apat|panglima|ikalima)`;

/**
 * Commands that only work on one screen (see laya/screenContext.ts). The
 * screen in focus gets the first say — "start the conversation" or "skip"
 * mean its own buttons — and everything else falls through to RULES.
 */
const SCREEN_RULES: Rule[] = [
  // ---- Conversation mode
  { intent: 'conv.say_reply', test: new RegExp(String.raw`\bquick\s+repl(?:y|ies)\s+(?:number\s+)?(?<n>\S+)$|^(?:say|use|send|sabihin)\s+(?:the\s+|ang\s+|yung\s+)?(?<n2>${ORDINAL})(?:ng)?\s+(?:quick\s+)?reply$`, 'u'), confidence: 0.9,
    slots: (_original, match) => {
      const number = parseNumber(match.groups?.n ?? match.groups?.n2);
      return number ? { number } : null;
    } },
  { intent: 'conv.quick_replies', test: /^(?:show|read|list|what are|open)?\s*(?:me\s+)?(?:my\s+|the\s+)?quick repl(?:y|ies)$|^mga quick reply$/u, confidence: 0.9 },
  { intent: 'conv.sign_mode', test: /\bsign(?:ing)?(?: language)? mode\b|\bsign language (?:on|off)\b|^(?:turn|switch) (?:on|off) sign/u, confidence: 0.9,
    slots: (original) => ({ on: !/\b(off|stop|close|exit|end|patayin|i-?off|alisin)\b/i.test(normalize(original)) }) },
  { intent: 'conv.my_turn', test: /^(?:it'?s )?my turn\b|^(?:i'?ll|let me|i want to|i will) (?:speak|talk|say something)\b|^ako(?: na)?$|^ako ang magsasalita|^turn ko\b/u, confidence: 0.9 },
  { intent: 'conv.their_turn', test: /^(?:it'?s )?(?:their|his|her|the other person'?s) turn\b|^(?:let )?(?:them|him|her) (?:speak|talk)\b|^listen to (?:them|him|her)\b|^(?:siya|sila)(?: na)?$|^turn (?:niya|nila)\b/u, confidence: 0.9 },
  { intent: 'conv.read_last', test: /\bwhat did (?:they|he|she|the other person) (?:just )?say\b|\bread what (?:they|he|she) said\b|\blast thing (?:they|he|she|the other person) said\b|\bano (?:ang )?(?:sinabi|sabi) (?:niya|nila)\b|\b(?:their|his|her) last (?:message|words)\b|^what they said$/u, confidence: 0.9 },
  { intent: 'conv.read_all', test: /\bread (?:me )?(?:the |this |our )?(?:whole )?(?:conversation|convo|usapan)\b|\bbasahin (?:ang |yung )?(?:usapan|conversation)\b|\bwhat have we said\b/u, confidence: 0.9 },
  { intent: 'conv.rename', test: /^(?:rename|call|name)\s+(?:it|this|the conversation|this conversation)\b|^(?:palitan ang pangalan|pangalanan)\b/u, confidence: 0.9,
    slots: (original) => {
      const name = clean(original).match(/^(?:rename|call|name)\s+(?:it|this|the conversation|this conversation)\s+(?:to\s+|as\s+)?(?<name>.+)$|^(?:palitan ang pangalan|pangalanan)\s+(?:ng\s+|ito\s+ng\s+|ito\s+)?(?<name2>.+)$/iu)?.groups;
      const found = (name?.name ?? name?.name2)?.replace(/[.!?]+$/, '').trim();
      return found ? { friendName: found } : {};
    } },
  { intent: 'conv.end', test: /^(?:end|finish|close|stop|tapusin|isara)\s+(?:the |this |our |ang )?(?:conversation|convo|usapan)\b|^(?:we'?re|i'?m) done talking\b/u, confidence: 0.9 },
  // "Say …" sends it as Me and speaks it — but "say that again" is read.repeat,
  // and "sabihin mo kay Ana…" is a message to a friend.
  { intent: 'conv.say', test: /^(?:say|sabihin(?: mo)?|pakisabi|i-?say)\s+(?!(?:that|it)\s+again\b)(?!(?:mo\s+)?(?:kay|kina|to)\s)(?!mo$)\S/u, confidence: 0.9,
    slots: (original) => {
      const words = clean(original).replace(/^(?:say|sabihin(?: mo)?|pakisabi|i-?say)\s+(?:na\s+|that\s+)?/i, '').trim();
      return words ? { messageText: words } : null;
    } },

  // ---- a Learn lesson
  { intent: 'learn.check', test: /^(?:check|check (?:it|my answer|the answer)|i-?check|tama|is that right|is it right)$/u, confidence: 0.9, hereOnly: true },
  { intent: 'learn.continue', test: /^(?:continue|next|go on|tuloy|ituloy|susunod|sunod|next question|go next)$/u, confidence: 0.9, hereOnly: true },
  { intent: 'learn.hear_steps', test: /\b(?:hear|read|say|tell me|repeat|ulitin)\b.*\bsteps?\b|\bhow (?:do i|to) (?:sign|make|do) (?:it|this|that)\b|^show me how$|^paano(?: gawin)?$/u, confidence: 0.9 },
  { intent: 'learn.skip', test: /^(?:skip|skip (?:it|this|this one|the camera)|laktawan|not now|i can'?t do it)$/u, confidence: 0.9, hereOnly: true },
  { intent: 'learn.choose', test: new RegExp(String.raw`^(?:the |yung |ang )?(?<n>${ORDINAL}|number \S+)(?: one| option| answer| choice)?$|^(?:choose|pick|select|answer|my answer is|is it|it'?s|piliin|pipiliin ko)\s+(?<word>.+)$`, 'u'), confidence: 0.9, hereOnly: true,
    slots: (original, match) => {
      const n = match.groups?.n?.replace(/^number\s+/, '');
      const number = parseNumber(n);
      if (number) return { number };
      const word = match.groups?.word?.trim();
      return word ? { messageText: word } : null;
    } },
  // Just the answer itself ("Thank you"): the lesson checks it's one of the choices.
  { intent: 'learn.choose', test: /^(?<word>[\p{L}' ]{1,40})$/u, confidence: 0.88, hereOnly: true,
    slots: (_original, match) => ({ messageText: match.groups!.word.trim() }) },

  // ---- Chats
  { intent: 'chats.read_newest', test: /\bread\b.*\b(?:newest|latest|most recent)\b|\b(?:newest|latest) (?:one|conversation|convo)\b|\bbasahin (?:ang |yung )?pinakabago/u, confidence: 0.9 },
  // "Open Ate Lyka": Chats checks there's a conversation by that name.
  { intent: 'chats.open', test: /^(?:open|buksan|go to)\s+\S/u, confidence: 0.9, hereOnly: true,
    slots: (original) => {
      const name = clean(original).match(/^(?:open|buksan|go to)\s+(?:the\s+|ang\s+|yung\s+|si\s+)?(?:conversation\s+|usapan(?:\s+na)?\s+)?(?:with\s+|called\s+|named\s+)?(?<name>.+?)(?:'s)?(?:\s+(?:conversation|convo|chat))?$/iu)?.groups?.name;
      return name ? { friendName: name.trim() } : null;
    } },
];

function tryRule(rule: Rule, text: string, said: string, whole: string): Understood | null {
  const match = (rule.keepLaya ? whole : said).match(rule.test);
  if (!match) return null;
  const slots = rule.slots ? rule.slots(text, match) : {};
  if (slots === null) return null; // pattern fit, but the details didn't — try the next rule
  return { intent: rule.intent, slots, confidence: rule.confidence ?? 0.85 };
}

/**
 * The phone's own guess at what was meant (confidence 0 = no idea).
 * `offers`: whether the screen in focus can do a screen command with these
 * details (laya/screenContext.ts). Its commands are tried first; one that
 * belongs to another screen is only a guess, kept for last, so Laya can
 * say where it works ("my turn" on Home → "That works in Conversation mode").
 */
export function matchRules(text: string, offers: (intent: IntentId, slots: Slots) => boolean = () => false): Understood {
  const said = stripFillers(text);
  if (!said) return { intent: 'none', slots: {}, confidence: 0 };
  // "Axel settings" still means Laya's settings.
  const whole = normalize(spellLaya(text));
  let elsewhere: Understood | null = null;
  for (const rule of SCREEN_RULES) {
    const found = tryRule(rule, text, said, whole);
    if (!found) continue;
    if (offers(found.intent, found.slots)) return found;
    if (!rule.hereOnly) elsewhere ??= { ...found, confidence: 0.8 };
  }
  for (const rule of RULES) {
    const found = tryRule(rule, text, said, whole);
    if (found) return found;
  }
  return elsewhere ?? { intent: 'none', slots: {}, confidence: 0 };
}

// "who is Jose Rizal", "ano ang ...", "tell me about ...": a question about
// the world, not a command. Laya doesn't answer those (she only works the
// app), and says so instead of "I didn't catch that".
const QUESTION_START =
  /^(?:(?:u+h*m+|uh+|ah+|so|well|okay|ok)\s+)*(?:(?:can you |could you |please |paki )?tell me(?: about)?|do you know|explain|define|who|whos|whose|what|whats|when|where|wheres|why|how|hows|which|is|are|was|were|does|did|sino|sinong|ano|anong|saan|nasaan|kailan|bakit|paano|ilan|magkano|alin)\b/;

/** Whether something Laya couldn't match sounds like a question. */
export function looksLikeQuestion(text: string): boolean {
  return text.trim().endsWith('?') || QUESTION_START.test(stripFillers(text).replace(/'/g, ''));
}
