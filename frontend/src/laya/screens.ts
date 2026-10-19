import type { LayaContext } from '@/laya/actions';
import { nameOf } from '@/laya/chat';
import { spellCode } from '@/laya/language';
import { listOf, type Lang } from '@/laya/phrases';
import { SCREENS } from '@/laya/screenTips';
import { SIGN_LANGUAGE_NAMES } from '@/components/sign/SignChoices';
import { PROFILE_LABELS } from '@/constants/profiles';
import { listConversations } from '@/db/conversations';
import { allLessons } from '@/learn/lessons';
import { courseProgress } from '@/learn/progress';
import { whenTextIn } from '@/utils/dates';
import { getCachedContacts } from '@/utils/emergencyContacts';
import { loadRecentSos } from '@/utils/sos';

/**
 * What each screen is, what it shows right now and what can be said there,
 * for someone who can't see it ("where am I", "what's on this screen",
 * "what can I do here") — in English or Filipino, whichever the question
 * was asked in. Keyed by the route path. Screens that keep their state
 * inside themselves (Chats, Conversation, a Learn lesson) describe
 * themselves instead — see laya/screenContext.ts. Screen names stay as
 * they're written on screen.
 */
type ScreenInfo = { name: string; tips: string };

export function describeScreen(pathname: string, friendName?: string | null, lang: Lang = 'en'): ScreenInfo {
  if (pathname.startsWith('/chat/')) {
    return lang === 'fil'
      ? {
          name: friendName ? `chat ninyo ni ${friendName}` : 'chat ninyo ng kaibigan mo',
          tips: 'Magsalita o mag-type ng message, tapos ipadala ito. Sabihin ang "basahin ang mga message" para marinig ang usapan.',
        }
      : {
          name: friendName ? `your chat with ${friendName}` : 'a chat with a friend',
          tips: 'Speak or type a message, then send it. Say "read their last message" to hear it.',
        };
  }
  const screen = SCREENS[pathname];
  if (!screen) {
    return { name: 'AccessAI', tips: lang === 'fil' ? 'Sabihin ang "punta sa home" para bumalik sa Home.' : 'Say "go home" to go back to Home.' };
  }
  return { name: screen.name, tips: screen[lang] };
}

const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/** The friend whose chat is open, if one is. */
function openChatFriend(ctx: LayaContext) {
  const id = ctx.pathname.startsWith('/chat/') ? ctx.pathname.split('/')[2] : null;
  return id ? (ctx.friends.find((friend) => friend.userId === id) ?? null) : null;
}

/** Friends' SOS still going, and the ones from this week that ended (from Home's saved list). */
async function sosLines(ctx: LayaContext): Promise<string[]> {
  const { lang } = ctx;
  const fil = lang === 'fil';
  const lines: string[] = [];
  if (ctx.friendSos.length) {
    const names = ctx.friendSos.map((sos) => sos.name);
    lines.push(fil ? `Nag-SOS si ${listOf(lang, names)}, at tuloy pa ito.` : `${listOf(lang, names)} sent an SOS that's still going.`);
  }
  if (ctx.mySos) lines.push(fil ? 'Tuloy pa ang SOS mo.' : 'Your SOS is active.');
  const saved = ctx.userId ? await loadRecentSos(ctx.userId) : null;
  const ended = (saved?.friends ?? []).filter((sos) => !sos.active);
  if (ended.length) {
    const list = ended.map((sos) => `${sos.name}, ${whenTextIn(lang, sos.occurredAt ?? sos.createdAt)}`).join('; ');
    lines.push(
      fil
        ? `Mga recent SOS: ${list}. Sabihin ang "sino ang nag-SOS" para marinig pa.`
        : `Recent SOS: ${list}. Say "who sent an SOS recently" to hear more.`,
    );
  }
  return lines;
}

function unreadLine(ctx: LayaContext): string {
  const unread = ctx.friends.filter((friend) => friend.unread > 0);
  if (ctx.lang === 'fil') return unread.length ? `May bagong message mula kay ${listOf('fil', unread.map(nameOf))}.` : 'Walang bagong message.';
  return unread.length ? `New messages from ${listOf('en', unread.map(nameOf))}.` : 'No new messages.';
}

function learnLine(ctx: LayaContext): string {
  const { prefs, learn, lang } = ctx;
  const fil = lang === 'fil';
  if (!prefs.signLanguageChosen) {
    return fil
      ? 'Pumili ng sign language na pag-aaralan: Filipino Sign Language o American Sign Language.'
      : 'Choose a sign language to learn: Filipino Sign Language or American Sign Language.';
  }
  const course = prefs.signLanguage;
  const progress = courseProgress(course, learn.completions);
  const next = progress.next ? allLessons(course).find((lesson) => lesson.id === progress.next) : null;
  const signs = next && next.kind !== 'review' ? listOf(lang, next.signs.map((sign) => sign.display)) : '';
  if (fil) {
    return [
      `Nag-aaral ka ng ${SIGN_LANGUAGE_NAMES[course]}. Tapos mo na ang ${progress.lessonsDone} sa ${progress.lessonsTotal} na lesson.`,
      next ? `Ang susunod ay ${next.title}${signs ? `, kasama ang ${signs}` : ''}.` : 'Tapos mo na ang lahat ng bukas na lesson.',
    ].join(' ');
  }
  return [
    `You're learning ${SIGN_LANGUAGE_NAMES[course]}. You've finished ${progress.lessonsDone} of ${progress.lessonsTotal} lessons.`,
    next ? `Next: ${next.title}${signs ? `, with ${signs}` : ''}.` : "You've finished every open lesson.",
  ].join(' ');
}

/**
 * What the screen shows right now, in a sentence or three — or null when
 * there's nothing live to say (then the screen's tips are said instead).
 */
export async function describeLive(ctx: LayaContext): Promise<string | null> {
  const { pathname, prefs, lang } = ctx;
  const fil = lang === 'fil';
  const onOff = (on: boolean) => (fil ? (on ? 'naka-on' : 'naka-off') : on ? 'on' : 'off');
  const chat = openChatFriend(ctx);
  if (chat) {
    if (fil) {
      const last = chat.lastMessage ? ` Ang huling message ay ${whenTextIn(lang, chat.lastMessage.createdAt)}.` : ' Hindi pa kayo nag-message.';
      return `${chat.unread ? `May ${chat.unread} na bagong message.` : 'Walang bagong message.'}${last}`;
    }
    const last = chat.lastMessage ? ` The last message was ${whenTextIn(lang, chat.lastMessage.createdAt)}.` : ' You haven’t messaged yet.';
    return `${chat.unread ? `${plural(chat.unread, 'new message')}.` : 'No new messages.'}${last}`;
  }
  switch (pathname) {
    case '/': {
      const conversations = await listConversations();
      const newest = conversations[0];
      const saved = newest
        ? fil
          ? `May ${conversations.length} kang naka-save na usapan; ang pinakabago ay ${newest.title}, ${whenTextIn(lang, newest.updatedAt)}.`
          : `You have ${plural(conversations.length, 'saved conversation')}; the newest is ${newest.title}, ${whenTextIn(lang, newest.updatedAt)}.`
        : fil
          ? 'Wala ka pang naka-save na usapan.'
          : "You don't have any saved conversations yet.";
      return [...(await sosLines(ctx)), saved, unreadLine(ctx)].join(' ');
    }
    case '/friends': {
      const online = ctx.connected ? ctx.friends.filter((friend) => friend.online).length : null;
      const requests = ctx.incomingRequests.length;
      if (fil) {
        return [
          `May ${ctx.friends.length} kang kaibigan${online !== null ? `; ${online} ang online` : ''}.`,
          unreadLine(ctx),
          requests ? `May ${requests} friend request.` : '',
        ]
          .filter(Boolean)
          .join(' ');
      }
      return [
        `You have ${plural(ctx.friends.length, 'friend')}${online !== null ? `; ${online} online` : ''}.`,
        unreadLine(ctx),
        requests ? `${plural(requests, 'friend request')}.` : '',
      ]
        .filter(Boolean)
        .join(' ');
    }
    case '/friends/requests': {
      const people = ctx.incomingRequests.map((request) => request.person.firstName || request.person.name);
      if (fil) return people.length ? `May request mula kina ${listOf(lang, people)}.` : 'Walang friend request ngayon.';
      return people.length ? `Requests from ${listOf(lang, people)}.` : 'No friend requests right now.';
    }
    case '/friends/add':
      if (fil) return ctx.friendCode ? `Ang friend code mo ay ${spellCode(ctx.friendCode)}.` : 'Lalabas ang friend code mo pag online ka na.';
      return ctx.friendCode ? `Your friend code is ${spellCode(ctx.friendCode)}.` : 'Your friend code appears once you are online.';
    case '/learn':
      return learnLine(ctx);
    case '/settings/needs':
      return fil ? `Ang needs mo ay ${PROFILE_LABELS[prefs.profile].title}.` : `Your needs are set to ${PROFILE_LABELS[prefs.profile].title}.`;
    case '/settings/display': {
      const size = Math.round(prefs.textScale * 100);
      if (fil) {
        return `Ang laki ng sulat ay ${size} percent. ${prefs.palette === 'high-contrast' ? 'High-contrast ang mga kulay.' : 'Standard ang mga kulay.'} ${prefs.boldText ? 'Naka-bold ang sulat.' : 'Hindi naka-bold ang sulat.'}`;
      }
      return `Text size ${size} percent. ${prefs.palette === 'high-contrast' ? 'High-contrast colors.' : 'Standard colors.'} Bold text ${onOff(prefs.boldText)}.`;
    }
    case '/settings/speech':
      if (fil) {
        return `${prefs.readIncomingAloud ? 'Binabasa' : 'Hindi binabasa'} nang malakas ang mga bagong message. ${prefs.speakMyMessages ? 'Sinasabi' : 'Hindi sinasabi'} nang malakas ang sarili mong mga message. Ang bilis ng boses ay ${prefs.speechRate} times.`;
      }
      return `Reading new messages aloud is ${onOff(prefs.readIncomingAloud)}. Speaking your own messages is ${onOff(prefs.speakMyMessages)}. Voice speed ${prefs.speechRate} times.`;
    case '/settings/quick-replies':
      if (fil) return prefs.quickReplies.length ? `May ${prefs.quickReplies.length} kang quick reply. Ang una ay: ${prefs.quickReplies[0]}.` : 'Wala kang quick reply.';
      return prefs.quickReplies.length
        ? `You have ${plural(prefs.quickReplies.length, 'quick reply', 'quick replies')}. The first is: ${prefs.quickReplies[0]}.`
        : 'You have no quick replies.';
    case '/settings/alerts':
      if (fil) return `${prefs.vibrateAlerts ? 'Naka-on' : 'Naka-off'} ang vibration. ${prefs.flashAlerts ? 'Naka-on' : 'Naka-off'} ang screen flash.`;
      return `Vibration ${onOff(prefs.vibrateAlerts)}. Screen flash ${onOff(prefs.flashAlerts)}.`;
    case '/settings/sos': {
      const circle = ctx.friends.filter((friend) => friend.inMySosCircle).map(nameOf);
      if (fil) {
        return [
          circle.length ? `Makakatanggap ng SOS mo ${circle.length > 1 ? 'sina' : 'si'} ${listOf(lang, circle)}.` : 'Wala pang kaibigang makakatanggap ng SOS mo.',
          `${prefs.shakeToSos ? 'Naka-on' : 'Naka-off'} ang shake to send SOS. ${prefs.sosCountdown} segundo ang countdown.`,
        ].join(' ');
      }
      return [
        circle.length ? `${listOf(lang, circle)} ${circle.length === 1 ? 'gets' : 'get'} your SOS.` : 'No friends get your SOS yet.',
        `Shake to send SOS is ${onOff(prefs.shakeToSos)}. The countdown is ${prefs.sosCountdown} seconds.`,
      ].join(' ');
    }
    case '/settings/laya':
      if (fil) return `${prefs.layaEnabled ? 'Naka-on' : 'Naka-off'} si Laya. ${prefs.layaWakeWord ? 'Naka-on' : 'Naka-off'} ang "Hey Laya".`;
      return `Laya is ${onOff(prefs.layaEnabled)}. "Hey Laya" is ${onOff(prefs.layaWakeWord)}.`;
    case '/settings/sign': {
      const unit = prefs.signUnit === 'letters' ? 'letters' : 'words';
      if (fil) return `Ang napili mo ay ${SIGN_LANGUAGE_NAMES[prefs.signLanguage]}, ${unit}, at camera sa ${prefs.signCamera === 'back' ? 'likod' : 'harap'}.`;
      return `${SIGN_LANGUAGE_NAMES[prefs.signLanguage]}, ${unit}, ${prefs.signCamera} camera.`;
    }
    case '/emergency-contacts': {
      const contacts = await getCachedContacts().catch(() => []);
      if (fil) return contacts.length ? `May ${contacts.length} kang emergency contact.` : 'Wala ka pang emergency contact.';
      return contacts.length ? `You have ${plural(contacts.length, 'emergency contact')}.` : 'You have no emergency contacts yet.';
    }
    default:
      return null;
  }
}

/** What can be said on this screen, most useful first ("what can I do here"), in the question's language. */
export function screenExamples(ctx: LayaContext): string[] {
  const fil = ctx.lang === 'fil';
  const chat = openChatFriend(ctx);
  if (chat) return fil ? ['basahin ang mga message', 'sagutin, papunta na ako', 'mga naunang message'] : ['read their last message', "reply, I'm on my way", 'older messages'];
  const friend = ctx.friends[0] ? nameOf(ctx.friends[0]) : 'Ana';
  switch (ctx.pathname) {
    case '/':
      return fil
        ? ['magsimula ng usapan', 'buksan ang huling usapan', 'may bagong message ba', 'ipakita nang malaki: salamat po', 'sino ang nag-SOS', 'buksan ang mga chat ko']
        : ['start a conversation', 'open my last conversation', 'any new messages', 'show big text, thank you', 'who sent an SOS recently', 'open chats'];
    case '/friends':
      return fil ? [`mag-chat kay ${friend}`, 'sino ang online', 'may bagong message ba', 'magdagdag ng kaibigan'] : [`chat with ${friend}`, "who's online", 'any new messages', 'add a friend'];
    case '/friends/requests': {
      const first = ctx.incomingRequests[0]?.person.firstName;
      if (fil) return first ? [`tanggapin ang request ni ${first}`, `tanggihan ang request ni ${first}`] : ['may friend request ba'];
      return first ? [`accept ${first}'s request`, `decline ${first}'s request`] : ['any friend requests'];
    }
    case '/friends/add':
      return fil ? ['ano ang friend code ko', 'i-add ang friend code, tapos ang code nang isa-isang letra'] : ["what's my friend code", 'add friend code, then the code letter by letter'];
    case '/learn':
      return fil ? ['simulan ang susunod na lesson', 'mag-practice ng signs'] : ['start the next lesson', 'practise signs'];
    case '/settings/speech':
    case '/settings/laya':
      return fil ? ['dahan-dahan', 'bilisan mo', 'boses ng babae'] : ['speak slower', 'speak faster', "use a woman's voice"];
    case '/settings/display':
      return fil ? ['palakihin ang sulat', 'paliitin ang sulat'] : ['make the text bigger', 'make the text smaller'];
    case '/settings/sos':
      return fil ? [`isama si ${friend} sa SOS circle ko`, `tanggalin si ${friend} sa SOS circle ko`] : [`add ${friend} to my SOS circle`, `remove ${friend} from my SOS circle`];
    default:
      return [];
  }
}
