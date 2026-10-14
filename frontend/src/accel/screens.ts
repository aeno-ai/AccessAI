import type { AccelContext } from '@/accel/actions';
import { nameOf } from '@/accel/chat';
import { spellCode } from '@/accel/language';
import { SIGN_LANGUAGE_NAMES } from '@/components/sign/SignChoices';
import { PROFILE_LABELS } from '@/constants/profiles';
import { listConversations } from '@/db/conversations';
import { allLessons } from '@/learn/lessons';
import { courseProgress, heartsNow, streakOf } from '@/learn/progress';
import { whenText } from '@/utils/dates';
import { getCachedContacts } from '@/utils/emergencyContacts';
import { joinNames, loadRecentSos } from '@/utils/sos';

/**
 * What each screen is, what it shows right now and what can be said there,
 * for someone who can't see it ("where am I", "what's on this screen",
 * "what can I do here"). Keyed by the route path. Screens that keep their
 * state inside themselves (Chats, Conversation, a Learn lesson) describe
 * themselves instead — see accel/screenContext.ts.
 */
type ScreenInfo = { name: string; tips: string };

const SCREENS: Record<string, ScreenInfo> = {
  '/': {
    name: 'Home',
    tips: 'From here you can start a conversation, use your shortcuts, or hold the SOS button.',
  },
  '/conversation': {
    name: 'Conversation mode',
    tips: 'Talk face to face. Tap the microphone to speak, or type. Choose Me or Them for who is talking.',
  },
  '/chats': { name: 'Chats', tips: 'Your saved in-person conversations. Tap one to open it.' },
  '/friends': { name: 'Friends', tips: 'Your friends. Tap a friend to chat. You can also add a friend from here.' },
  '/friends/add': {
    name: 'Add a friend',
    tips: 'Share your friend code or QR code, or type or scan a friend’s code. Say "what is my friend code" to hear yours.',
  },
  '/friends/requests': { name: 'Friend requests', tips: 'Accept or decline people who want to be your friend.' },
  '/learn': { name: 'Learn', tips: 'Short lessons to learn sign language, with camera practice.' },
  '/learn-lesson': { name: 'a Learn lesson', tips: 'Answer each question, then check it.' },
  '/learn-practice': { name: 'Practice', tips: 'Practise any sign you learned in front of the camera.' },
  '/learn-badges': { name: 'Badges', tips: 'The badges you earned in Learn, and the ones still to get.' },
  '/learn-leaderboard': { name: 'the Leaderboard', tips: "This week's points for you and your friends." },
  '/learn-credits': { name: 'Learn credits', tips: 'Where the sign videos and the sign models come from.' },
  '/settings': { name: 'Settings', tips: 'My needs, display, conversation and speech, quick replies, alerts, SOS and Accel.' },
  '/settings/needs': { name: 'Settings, My needs', tips: 'Choose Blind or low vision, Deaf or hard of hearing, or Mute.' },
  '/settings/display': { name: 'Settings, Display and text', tips: 'Text size, bold text, colors and dark mode.' },
  '/settings/speech': { name: 'Settings, Conversation and speech', tips: 'Reading aloud, voice speed, and a man’s or woman’s voice.' },
  '/settings/quick-replies': { name: 'Settings, Quick replies', tips: 'Add, edit and reorder your quick replies.' },
  '/settings/alerts': { name: 'Settings, Alerts', tips: 'Vibration and screen flash for alerts.' },
  '/settings/sos': { name: 'Settings, Emergency SOS', tips: 'Choose which friends get your SOS, shake to send, and the countdown.' },
  '/settings/accel': { name: 'Settings, Accel', tips: 'Turn me on or off, "Hey Accel", and my voice.' },
  '/settings/sign': { name: 'Settings, Sign language', tips: 'FSL or ASL, words or letters, and the camera.' },
  '/accel-guide': { name: 'What Accel can do', tips: 'Every command, with examples you can try.' },
  '/profile': { name: 'Edit profile', tips: 'Your name and the note your friends see.' },
  '/change-email': { name: 'Change email', tips: 'Type your new email, then the code we send to it.' },
  '/change-password': { name: 'Change password', tips: 'Type your current password, then the new one.' },
  '/emergency-contacts': {
    name: 'Emergency contacts',
    tips: 'The phone numbers that get a text with your location when you send an SOS.',
  },
};

export function describeScreen(pathname: string, friendName?: string | null): ScreenInfo {
  if (pathname.startsWith('/chat/')) {
    return {
      name: friendName ? `your chat with ${friendName}` : 'a chat with a friend',
      tips: 'Speak or type a message, then send it. Say "read their last message" to hear it.',
    };
  }
  return SCREENS[pathname] ?? { name: 'AccessAI', tips: 'Say "go home" to go back to Home.' };
}

const onOff = (on: boolean) => (on ? 'on' : 'off');
const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;

/** The friend whose chat is open, if one is. */
function openChatFriend(ctx: AccelContext) {
  const id = ctx.pathname.startsWith('/chat/') ? ctx.pathname.split('/')[2] : null;
  return id ? (ctx.friends.find((friend) => friend.userId === id) ?? null) : null;
}

/** Friends' SOS still going, and the ones from this week that ended (from Home's saved list). */
async function sosLines(ctx: AccelContext): Promise<string[]> {
  const lines: string[] = [];
  if (ctx.friendSos.length) {
    const names = ctx.friendSos.map((sos) => sos.name);
    lines.push(`${joinNames(names)} sent an SOS that's still going.`);
  }
  if (ctx.mySos) lines.push('Your SOS is active.');
  const saved = ctx.userId ? await loadRecentSos(ctx.userId) : null;
  const ended = (saved?.friends ?? []).filter((sos) => !sos.active);
  if (ended.length) {
    lines.push(
      `Recent SOS: ${ended.map((sos) => `${sos.name}, ${whenText(sos.occurredAt ?? sos.createdAt)}`).join('; ')}. Say "who sent an SOS recently" to hear more.`,
    );
  }
  return lines;
}

function unreadLine(ctx: AccelContext): string {
  const unread = ctx.friends.filter((friend) => friend.unread > 0);
  return unread.length ? `New messages from ${joinNames(unread.map(nameOf))}.` : 'No new messages.';
}

function learnLine(ctx: AccelContext): string {
  const { prefs, learn } = ctx;
  if (!prefs.signLanguageChosen) return 'Choose a sign language to learn: Filipino Sign Language or American Sign Language.';
  const course = prefs.signLanguage;
  const now = Date.now();
  const progress = courseProgress(course, learn.completions);
  const next = progress.next ? allLessons(course).find((lesson) => lesson.id === progress.next) : null;
  const hearts = heartsNow(learn.hearts, now).hearts.count;
  const streak = streakOf(learn.completions, now).current;
  return [
    `You're learning ${SIGN_LANGUAGE_NAMES[course]}, level ${progress.level}, with ${progress.lessonsDone} of ${progress.lessonsTotal} levels done.`,
    next
      ? `Next: ${next.title}${next.kind === 'review' ? '' : `, with ${joinNames(next.signs.map((sign) => sign.display))}`}.`
      : "You've finished every open level.",
    `${plural(hearts, 'heart')}. ${streak ? `A ${streak}-day streak.` : 'No streak yet today.'}`,
  ].join(' ');
}

/**
 * What the screen shows right now, in a sentence or three — or null when
 * there's nothing live to say (then the screen's tips are said instead).
 */
export async function describeLive(ctx: AccelContext): Promise<string | null> {
  const { pathname, prefs } = ctx;
  const chat = openChatFriend(ctx);
  if (chat) {
    const last = chat.lastMessage ? ` The last message was ${whenText(chat.lastMessage.createdAt)}.` : ' You haven’t messaged yet.';
    return `${chat.unread ? `${plural(chat.unread, 'new message')}.` : 'No new messages.'}${last}`;
  }
  switch (pathname) {
    case '/': {
      const conversations = await listConversations();
      const saved = conversations.length
        ? `You have ${plural(conversations.length, 'saved conversation')}; the newest is ${conversations[0].title}, ${whenText(conversations[0].updatedAt)}.`
        : "You don't have any saved conversations yet.";
      return [...(await sosLines(ctx)), saved, unreadLine(ctx)].join(' ');
    }
    case '/friends': {
      const online = ctx.connected ? ctx.friends.filter((friend) => friend.online).length : null;
      const requests = ctx.incomingRequests.length;
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
      return people.length ? `Requests from ${joinNames(people)}.` : 'No friend requests right now.';
    }
    case '/friends/add':
      return ctx.friendCode ? `Your friend code is ${spellCode(ctx.friendCode)}.` : 'Your friend code appears once you are online.';
    case '/learn':
      return learnLine(ctx);
    case '/settings/needs':
      return `Your needs are set to ${PROFILE_LABELS[prefs.profile].title}.`;
    case '/settings/display':
      return `Text size ${Math.round(prefs.textScale * 100)} percent. ${prefs.palette === 'high-contrast' ? 'High-contrast colors.' : 'Standard colors.'} Bold text ${onOff(prefs.boldText)}.`;
    case '/settings/speech':
      return `Reading new messages aloud is ${onOff(prefs.readIncomingAloud)}. Speaking your own messages is ${onOff(prefs.speakMyMessages)}. Voice speed ${prefs.speechRate} times.`;
    case '/settings/quick-replies':
      return prefs.quickReplies.length
        ? `You have ${plural(prefs.quickReplies.length, 'quick reply', 'quick replies')}. The first is: ${prefs.quickReplies[0]}.`
        : 'You have no quick replies.';
    case '/settings/alerts':
      return `Vibration ${onOff(prefs.vibrateAlerts)}. Screen flash ${onOff(prefs.flashAlerts)}.`;
    case '/settings/sos': {
      const circle = ctx.friends.filter((friend) => friend.inMySosCircle).map(nameOf);
      return [
        circle.length ? `${joinNames(circle)} ${circle.length === 1 ? 'gets' : 'get'} your SOS.` : 'No friends get your SOS yet.',
        `Shake to send SOS is ${onOff(prefs.shakeToSos)}. The countdown is ${prefs.sosCountdown} seconds.`,
      ].join(' ');
    }
    case '/settings/accel':
      return `Accel is ${onOff(prefs.accelEnabled)}. "Hey Accel" is ${onOff(prefs.accelWakeWord)}.`;
    case '/settings/sign':
      return `${SIGN_LANGUAGE_NAMES[prefs.signLanguage]}, ${prefs.signUnit === 'letters' ? 'letters' : 'words'}, ${prefs.signCamera} camera.`;
    case '/emergency-contacts': {
      const contacts = await getCachedContacts().catch(() => []);
      return contacts.length ? `You have ${plural(contacts.length, 'emergency contact')}.` : 'You have no emergency contacts yet.';
    }
    default:
      return null;
  }
}

/** What can be said on this screen, most useful first ("what can I do here"). */
export function screenExamples(ctx: AccelContext): string[] {
  const chat = openChatFriend(ctx);
  if (chat) return ['read their last message', "reply, I'm on my way", 'older messages'];
  const friend = ctx.friends[0] ? nameOf(ctx.friends[0]) : 'Ana';
  switch (ctx.pathname) {
    case '/':
      return ['start a conversation', 'open my last conversation', 'any new messages', 'who sent an SOS recently', 'open chats'];
    case '/friends':
      return [`chat with ${friend}`, "who's online", 'any new messages', 'add a friend'];
    case '/friends/requests': {
      const first = ctx.incomingRequests[0]?.person.firstName;
      return first ? [`accept ${first}'s request`, `decline ${first}'s request`] : ['any friend requests'];
    }
    case '/friends/add':
      return ["what's my friend code", 'add friend code, then the code letter by letter'];
    case '/learn':
      return ['start the next lesson', 'practise signs'];
    case '/settings/speech':
    case '/settings/accel':
      return ['speak slower', 'speak faster', "use a woman's voice"];
    case '/settings/display':
      return ['make the text bigger', 'make the text smaller'];
    case '/settings/sos':
      return [`add ${friend} to my SOS circle`, `remove ${friend} from my SOS circle`];
    default:
      return [];
  }
}
