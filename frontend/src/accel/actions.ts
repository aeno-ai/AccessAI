import { router, type Href } from 'expo-router';
import { apiFetch } from '@/api/apiClient';
import { INTENTS, screenOf, type IntentId, type Slots } from '@/accel/catalog';
import { chatFriend, chatMessages, lineFor, nameOf, pageFromNewest, spokenAgo, unreadFrom } from '@/accel/chat';
import { matchFriend, spellCode, stripFillers } from '@/accel/language';
import { currentScreen } from '@/accel/screenContext';
import { describeLive, describeScreen, screenExamples } from '@/accel/screens';
import { isOnlineNow, polishMessage } from '@/accel/understand';
import { friendRecentText } from '@/components/sos/RecentSosCard';
import { listConversations } from '@/db/conversations';
import { addPendingMessage, flushOutbox, getDirectMessages } from '@/db/directMessages';
import type { Friend } from '@/db/friends';
import type { Preferences, SpeechRate, TextScale } from '@/hooks/use-preferences';
import { allLessons } from '@/learn/lessons';
import { openLesson } from '@/learn/open';
import { courseProgress, heartsNow } from '@/learn/progress';
import type { Completion, Hearts } from '@/learn/types';
import type { FriendRequest } from '@/realtime/FriendsProvider';
import { openSavedConversation, startNamedConversation } from '@/utils/conversationNav';
import { whenText } from '@/utils/dates';
import type { FriendSos, MySos, SosMethod } from '@/utils/sos';
import { fetchRecentSos, joinNames, loadRecentSos, saveRecentSos } from '@/utils/sos';
import { setSosCircle } from '@/utils/sosCircle';
import { goBack } from '@/utils/navigation';

/**
 * What Accel does for each command. Every plan is one of:
 * - say:     just answer
 * - confirm: ask a yes/no question first; only "yes" runs it ("no" cancels,
 *            or does `no` — e.g. skip to the next friend)
 * - do:      act straight away (the SOS, whose countdown can be cancelled,
 *            and reading chats aloud)
 * - choose:  "Which Ana?" — then the answer picks one of the options
 * - ask:     a question whose answer is words, not a command ("What do you
 *            want to tell Andrew?")
 * An outcome can carry a `next` plan, so steps chain into a short dialog.
 *
 * What Accel SAYS is always one of the fixed sentences below, filled in
 * with names and details — never text the AI wrote. And nothing here can
 * delete an account, sign out or unfriend anyone.
 */
export type Outcome = { say: string; after?: () => void; next?: Plan };

export type Plan =
  | { kind: 'say'; text: string }
  | { kind: 'confirm'; question: string; run: () => Promise<Outcome>; no?: () => Promise<Plan> }
  | { kind: 'do'; run: () => Promise<Outcome> }
  | { kind: 'choose'; question: string; options: { label: string; friend: Friend; plan: () => Promise<Plan> }[] }
  | { kind: 'ask'; question: string; answer: (text: string) => Promise<Plan> };

export type AccelContext = {
  pathname: string;
  friends: Friend[];
  connected: boolean;
  incomingRequests: FriendRequest[];
  friendCode: string | null;
  refreshFriends: () => Promise<Friend[]>;
  sosAvailable: boolean;
  mySos: MySos | null;
  /** An SOS made offline is waiting to go out. */
  sosPending: boolean;
  startSos: (method: SosMethod) => void;
  markSafe: () => Promise<void>;
  prefs: Preferences;
  setPref: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  lastSpoken: string | null;
  /** How far back Accel has read in each chat (friend id → messages from the newest). */
  readPositions: Map<string, number>;
  /** Marks a chat read (here and for the friend). */
  markRead: (friendId: string) => Promise<void>;
  /** Friends' SOS still going. */
  friendSos: FriendSos[];
  userId: string | null;
  /** Learn progress, for "start the next lesson" and the Learn screen. */
  learn: { completions: Completion[]; hearts: Hearts };
};

const SPEECH_RATES: SpeechRate[] = [0.75, 1, 1.25, 1.5];
const TEXT_SCALES: TextScale[] = [1, 1.15, 1.3, 1.5];

const say = (text: string): Plan => ({ kind: 'say', text });
const go = (href: Href) => () => router.navigate(href);
const errorText = (error: unknown) => (error instanceof Error ? error.message : "That didn't work. Please try again.");

// Paths of screens added with Accel (typed routes catch up on the next `expo start`).
const SCREEN: Partial<Record<IntentId, string>> = {
  'nav.home': '/',
  'nav.chats': '/chats',
  'nav.friends': '/friends',
  'nav.friend_requests': '/friends/requests',
  'nav.learn': '/learn',
  'nav.settings': '/settings',
  'nav.settings_needs': '/settings/needs',
  'nav.settings_display': '/settings/display',
  'nav.settings_speech': '/settings/speech',
  'nav.settings_alerts': '/settings/alerts',
  'nav.settings_sos': '/settings/sos',
  'nav.settings_accel': '/settings/accel',
  'nav.emergency_contacts': '/emergency-contacts',
  'nav.profile': '/profile',
  'nav.accel_guide': '/accel-guide',
};

// "he", "her"… inside a chat mean that friend, not someone called He.
const PRONOUN = /^(he|she|they|him|her|them|siya|niya|nila|sya|nya)$/i;

/**
 * Finds the friend, or asks which one, or says nobody matched. With no name
 * (or "him"), `fallback` — the friend whose chat is open — is used.
 */
function withFriend(
  name: string | undefined,
  people: Friend[],
  prompt: string,
  next: (friend: Friend) => Promise<Plan> | Plan,
  fallback: Friend | null = null,
): Promise<Plan> | Plan {
  if (!name || PRONOUN.test(name.trim())) return fallback ? next(fallback) : say(prompt);
  const match = matchFriend(name, people);
  if (!match) return say(`I couldn't find ${name} among your friends.`);
  if ('friend' in match) return next(match.friend);
  return {
    kind: 'choose',
    question: `Which one: ${joinNames(match.choices.map((friend) => friend.name)).replace(' and ', ' or ')}?`,
    options: match.choices.map((friend) => ({ label: friend.name, friend, plan: async () => next(friend) })),
  };
}

// What "Hey Accel" sounds like in a tip, when it's on.
const callAccel = (ctx: AccelContext) => (ctx.prefs.accelWakeWord ? 'Hey Accel, ' : '');

/** A spoken answer cleaned up: "to Andrew" → "Andrew", "kay Ana" → "Ana". */
function spokenName(text: string): string {
  return stripFillers(text).replace(/^(to|si|kay|kina|ni|for|with)\s+/, '').trim();
}

/** "Tell him I'm outside", as the answer to "What do you want to tell…?" → "I'm outside". */
function spokenMessage(text: string): string {
  return text.trim().replace(/^(say|tell (him|her|them)|sabihin (mo )?(na)?)\s+(that\s+)?/i, '').trim() || text.trim();
}

/** "Send to Andrew: '…'?" — then sends (or saves it for when back online). `then` continues a walk-through. */
async function confirmSend(friend: Friend, raw: string, ctx: AccelContext, then?: () => Promise<Plan>): Promise<Plan> {
  const text = await polishMessage(raw, ctx.prefs.accelSmart);
  const name = nameOf(friend);
  return {
    kind: 'confirm',
    question: `Send to ${name}: "${text}"?`,
    run: async () => {
      await addPendingMessage(friend.userId, text);
      await flushOutbox().catch(() => {});
      return {
        say: (await isOnlineNow()) ? `Sent to ${name}.` : `Saved. It will send to ${name} when you're back online.`,
        next: then ? await then() : undefined,
      };
    },
    no: then ? async () => ({ kind: 'do', run: async () => ({ say: "Okay, I won't send it.", next: await then() }) }) : undefined,
  };
}

/** "What do you want to tell Andrew?" → the answer → confirm → send. */
function askMessage(friend: Friend, ctx: AccelContext, then?: () => Promise<Plan>): Plan {
  return {
    kind: 'ask',
    question: `What do you want to tell ${nameOf(friend)}?`,
    answer: async (text) => confirmSend(friend, spokenMessage(text), ctx, then),
  };
}

/**
 * Reads `count` messages of a chat (before the newest `skip`), oldest
 * first, then offers older ones. Marks the chat read.
 */
function readChat(friend: Friend, ctx: AccelContext, count: number, skip: number, words: { intro?: string; end?: string } = {}): Plan {
  return {
    kind: 'do',
    run: async () => {
      const messages = await chatMessages(friend.userId, await isOnlineNow());
      const page = pageFromNewest(messages, count, skip);
      if (!page.length) {
        return { say: skip ? 'There are no older messages.' : `You and ${nameOf(friend)} haven't messaged yet.` };
      }
      ctx.readPositions.set(friend.userId, skip + page.length);
      if (skip === 0 && friend.unread > 0) await ctx.markRead(friend.userId);
      const lines = page.map((message) => lineFor(message, friend)).join(' ');
      const more = messages.length > skip + page.length;
      return {
        say: `${words.intro ?? ''}${lines}${words.end ?? ''}`,
        next:
          more && !words.end
            ? {
                kind: 'confirm',
                question: 'Hear older messages?',
                run: async () => ({ say: '', next: readChat(friend, ctx, 5, skip + page.length) }),
                no: async () => say('Okay.'),
              }
            : undefined,
      };
    },
  };
}

/** "Any new messages?": each friend's new messages, then "Reply to Andrew?", then the next friend. */
function inboxStep(list: Friend[], index: number, ctx: AccelContext, extra: string): Plan {
  if (index >= list.length) return say(`That's all your new messages.${extra}`);
  const friend = list[index];
  const name = nameOf(friend);
  const nextStep = async () => inboxStep(list, index + 1, ctx, extra);
  return {
    kind: 'do',
    run: async () => {
      const messages = await chatMessages(friend.userId, await isOnlineNow());
      const fresh = unreadFrom(messages, friend);
      if (fresh.length) ctx.readPositions.set(friend.userId, messages.length - messages.indexOf(fresh[0]));
      await ctx.markRead(friend.userId);
      const intro = index === 0 ? `New messages from ${joinNames(list.map(nameOf))}. ` : '';
      const lines = fresh.length ? fresh.map((message) => lineFor(message, friend)).join(' ') : `${name} sent you a message.`;
      return {
        say: intro + lines,
        next: {
          kind: 'confirm',
          question: `Reply to ${name}?`,
          run: async () => ({ say: '', next: askMessage(friend, ctx, nextStep) }),
          no: nextStep,
        },
      };
    },
  };
}

/** Who "reply" answers: the open chat, else whoever messaged last. */
function lastToMessage(ctx: AccelContext): Friend | null {
  const open = chatFriend(ctx);
  if (open) return open;
  const theirs = ctx.friends.filter((friend) => friend.lastMessage && !friend.lastMessage.fromMe);
  theirs.sort((a, b) => (b.lastMessage?.createdAt ?? 0) - (a.lastMessage?.createdAt ?? 0));
  return theirs[0] ?? null;
}

/** A screen command asked somewhere else: where it works, and how to get there. */
function elsewhere(where: string, ctx: AccelContext): Plan {
  const how = where === 'Conversation mode' ? 'start a conversation' : where === 'Chats' ? 'open my chats' : 'start the next lesson';
  return say(`That works in ${where}. To go there, say: ${callAccel(ctx)}${how}.`);
}

/** "You're on Home. You have 3 saved conversations…" — what the screen shows right now. */
async function screenNow(ctx: AccelContext): Promise<string> {
  const registered = currentScreen();
  const friend = chatFriend(ctx);
  const screen = describeScreen(ctx.pathname, friend ? nameOf(friend) : null);
  const live = registered ? await registered.describe() : await describeLive(ctx);
  return `You're on ${registered?.name ?? screen.name}. ${live ?? screen.tips}`;
}

/** Each friend's latest SOS this week: from the server when online, else the copy Home saved. */
async function recentSos(ctx: AccelContext) {
  if (!ctx.userId) return null;
  try {
    const list = await fetchRecentSos();
    void saveRecentSos(ctx.userId, { ...list, fetchedAt: Date.now() });
    return { list, savedAt: null as number | null };
  } catch {
    const saved = await loadRecentSos(ctx.userId);
    return saved ? { list: saved, savedAt: saved.fetchedAt } : null;
  }
}

export async function planFor(intent: IntentId, slots: Slots, ctx: AccelContext): Promise<Plan> {
  const label = INTENTS[intent].label;

  // ---- this screen's own commands (Chats, Conversation mode, a Learn lesson)
  const own = currentScreen()?.commands[intent];
  if (own) return own(slots);
  const where = screenOf(intent);
  if (where && intent !== 'conv.start') return elsewhere(where, ctx);

  // ---- going places: say where, then go there
  const path = SCREEN[intent];
  if (path) {
    return {
      kind: 'confirm',
      question: `You want me to take you to ${label}?`,
      run: async () => ({ say: `Opening ${label}.`, after: go(path as Href) }),
    };
  }

  switch (intent) {
    case 'nav.conversation':
      return {
        kind: 'confirm',
        question: 'You want me to take you to Conversation mode?',
        run: async () => ({
          say: 'Opening Conversation mode. The microphone will turn on — start talking after the beep.',
          after: () =>
            router.navigate({ pathname: '/conversation', params: { action: 'listen', opened: String(Date.now()) } }),
        }),
      };

    case 'nav.back':
      return {
        kind: 'confirm',
        question: 'Go back to the previous screen?',
        run: async () => ({ say: 'Going back.', after: () => goBack() }),
      };

    case 'nav.add_friend':
      return {
        kind: 'confirm',
        question: 'You want me to take you to Add a friend?',
        run: async () => ({
          say: ctx.friendCode
            ? `Opening Add a friend. Your friend code is ${spellCode(ctx.friendCode)}. Ask your friend to type it in, or to scan the QR code on this screen.`
            : 'Opening Add a friend. Your friend code appears once you are online.',
          after: go('/friends/add'),
        }),
      };

    case 'nav.chat_with':
      return withFriend(slots.friendName, ctx.friends, 'Which friend? For example, say "open my chat with Ana".', (friend) => ({
        kind: 'confirm',
        question: `Open your chat with ${friend.name}?`,
        run: async () => ({
          say: '',
          after: () => router.navigate({ pathname: '/chat/[friendId]', params: { friendId: friend.userId } }),
          // Then hear it: the last 3 messages, and how to go on.
          next: readChat(friend, ctx, 3, 0, {
            intro: `Your chat with ${nameOf(friend)}. `,
            end: ` To answer, say: ${callAccel(ctx)}reply. To hear more, say: ${callAccel(ctx)}older messages.`,
          }),
        }),
      }));

    // ---- emergency
    case 'sos.send':
      if (!ctx.sosAvailable) return say('Sending an SOS is only for PWD accounts.');
      // The countdown is the confirmation: it can still be cancelled.
      return { kind: 'do', run: async () => ({ say: '', after: () => ctx.startSos('voice') }) };

    case 'sos.im_safe':
      if (!ctx.mySos && !ctx.sosPending) return say("You don't have an SOS going right now.");
      if (!ctx.mySos) {
        return {
          kind: 'confirm',
          question: "Your SOS hasn't gone out yet, because there's no internet. Cancel it?",
          run: async () => {
            await ctx.markSafe();
            return { say: "Okay. Your SOS won't be sent." };
          },
        };
      }
      return {
        kind: 'confirm',
        question: "End your SOS and tell your friends you're safe?",
        run: async () => {
          try {
            await ctx.markSafe();
            return { say: "Done. Your friends were told you're safe." };
          } catch (error) {
            return { say: errorText(error) };
          }
        },
      };

    case 'sos.circle_add':
    case 'sos.circle_remove': {
      const adding = intent === 'sos.circle_add';
      return withFriend(slots.friendName, ctx.friends, 'Which friend?', (friend) => ({
        kind: 'confirm',
        question: adding
          ? `Add ${friend.name} to your SOS circle? They'll get your SOS alerts.`
          : `Remove ${friend.name} from your SOS circle? They won't get your SOS alerts any more.`,
        run: async () => {
          try {
            await setSosCircle(friend.userId, adding);
            await ctx.refreshFriends();
            return { say: adding ? `${friend.firstName} will now get your SOS alerts.` : `${friend.firstName} won't get your SOS alerts.` };
          } catch (error) {
            return { say: errorText(error) };
          }
        },
      }));
    }

    // ---- reading things aloud
    case 'read.new_messages': {
      const unread = ctx.friends.filter((friend) => friend.unread > 0);
      const requests = ctx.incomingRequests.length;
      const extra = requests ? ` You also have ${requests} friend ${requests === 1 ? 'request' : 'requests'}.` : '';
      if (!unread.length) return say(`No new messages.${extra}`);
      return inboxStep(unread, 0, ctx, extra);
    }

    case 'read.chat_with':
      return withFriend(
        slots.friendName,
        ctx.friends,
        'Whose chat? For example, say "read my chat with Ana".',
        (friend) => readChat(friend, ctx, 5, 0),
        chatFriend(ctx),
      );

    case 'read.older_messages':
      return withFriend(
        slots.friendName,
        ctx.friends,
        'Open a chat first, or say "read my chat with Ana".',
        (friend) => readChat(friend, ctx, 5, ctx.readPositions.get(friend.userId) ?? 0),
        chatFriend(ctx),
      );

    case 'read.my_last_message':
      return withFriend(
        slots.friendName,
        ctx.friends,
        'To whom? For example, say "read my last message to Ana".',
        async (friend) => {
          const messages = await chatMessages(friend.userId, await isOnlineNow());
          const mine = [...messages].reverse().find((message) => message.fromMe);
          if (!mine) return say(`You haven't sent ${nameOf(friend)} a message yet.`);
          const waiting = mine.status === 'pending' ? " It's waiting to send." : '';
          return say(`You said to ${nameOf(friend)}, ${spokenAgo(mine.createdAt)}: ${mine.body}${waiting}`);
        },
        chatFriend(ctx),
      );

    case 'read.last_message_from':
      return withFriend(slots.friendName, ctx.friends, 'Whose message? For example, say "read Ana\'s last message".', async (friend) => {
        const messages = await getDirectMessages(friend.userId);
        const last = [...messages].reverse().find((message) => !message.fromMe);
        if (!last) return say(`There are no messages from ${friend.firstName || friend.name} yet.`);
        const minutes = Math.round((Date.now() - last.createdAt) / 60000);
        const when = minutes < 1 ? 'just now' : minutes < 60 ? `${minutes} minutes ago` : 'earlier';
        return say(
          last.kind === 'sos'
            ? `${friend.firstName} sent an SOS ${when}: ${last.body}`
            : `${friend.firstName || friend.name} said, ${when}: ${last.body}`,
        );
      }, chatFriend(ctx));

    case 'read.who_online': {
      if (!ctx.connected) return say("I can't tell who's online while you're offline.");
      const online = ctx.friends.filter((friend) => friend.online).map((friend) => friend.firstName || friend.name);
      return say(online.length ? `${joinNames(online)} ${online.length === 1 ? 'is' : 'are'} online.` : 'None of your friends are online right now.');
    }

    case 'read.where_am_i':
    case 'read.screen':
      return say(await screenNow(ctx));

    // "What can I do here": this screen's commands first, then the ones that work everywhere.
    case 'read.help': {
      const registered = currentScreen();
      const friend = chatFriend(ctx);
      const name = registered?.name ?? describeScreen(ctx.pathname, friend ? nameOf(friend) : null).name;
      const examples = (registered?.examples ?? screenExamples(ctx)).slice(0, 6);
      const here = examples.length ? `On ${name}, you can say: ${examples.join('. ')}. ` : '';
      return say(
        `${here}Anywhere, you can say: go home. Any new messages? What's on this screen? Or, in an emergency: SOS. Say "show me what you can do" for the full list.`,
      );
    }

    case 'read.recent_sos': {
      const found = await recentSos(ctx);
      if (!found) return say("I can't check recent SOS right now. Try again when you're online.");
      const { friends, mine } = found.list;
      const lines = friends.map((sos) => `${sos.name}: ${friendRecentText(sos, ctx.userId)}${sos.active ? ' It is still going.' : ''}`);
      if (mine) lines.push(`Your last SOS was ${whenText(mine.occurredAt ?? mine.createdAt)}${mine.active ? ', and it is still going' : ''}.`);
      if (!lines.length) return say('No SOS in the past week.');
      const old = found.savedAt ? ` This is from ${whenText(found.savedAt)}; you're offline.` : '';
      return say(`${lines.join(' ')}${old}`);
    }

    case 'nav.last_conversation': {
      const [latest] = await listConversations();
      if (!latest) return say(`You don't have any saved conversations yet. Say: ${callAccel(ctx)}start a conversation.`);
      return {
        kind: 'confirm',
        question: `Open your last conversation, ${latest.title}?`,
        run: async () => ({ say: `Opening ${latest.title}.`, after: () => openSavedConversation(latest.id) }),
      };
    }

    // Anywhere but Conversation mode itself (that screen handles it).
    case 'conv.start': {
      const name = slots.friendName;
      if (!name) return planFor('nav.conversation', {}, ctx);
      return {
        kind: 'confirm',
        question: `Start a new conversation called ${name}?`,
        run: async () => ({ say: `Starting a conversation called ${name}.`, after: () => startNamedConversation(name) }),
      };
    }

    case 'learn.next_lesson': {
      if (!ctx.prefs.signLanguageChosen) {
        return {
          kind: 'confirm',
          question: "You haven't picked a sign language yet. Open Learn to choose one?",
          run: async () => ({ say: 'Opening Learn.', after: go('/learn') }),
        };
      }
      const course = ctx.prefs.signLanguage;
      const progress = courseProgress(course, ctx.learn.completions);
      const lesson = progress.next ? allLessons(course).find((l) => l.id === progress.next) : null;
      if (!lesson) return say("You've finished every level that's open. Well done!");
      if (lesson.kind !== 'review' && heartsNow(ctx.learn.hearts, Date.now()).hearts.count <= 0) {
        return say("You're out of hearts. One comes back every 30 minutes. You can still practise signs.");
      }
      const teaches = lesson.kind === 'review' ? 'It goes over every sign of the unit.' : `It teaches ${joinNames(lesson.signs.map((sign) => sign.display))}.`;
      return {
        kind: 'confirm',
        question: `Start ${lesson.title} of ${lesson.unitTitle}? ${teaches}`,
        run: async () => ({ say: `Starting ${lesson.title}.`, after: () => openLesson(lesson.id) }),
      };
    }

    case 'learn.practice':
      return {
        kind: 'confirm',
        question: 'You want me to take you to sign practice?',
        run: async () => ({ say: 'Opening Practice.', after: go('/learn-practice' as Href) }),
      };

    case 'blocked.outside':
      return say('I can only help inside AccessAI.');

    case 'read.repeat':
      return say(ctx.lastSpoken ?? "I haven't said anything yet.");

    case 'read.my_friend_code':
      return say(
        ctx.friendCode
          ? `Your friend code is ${spellCode(ctx.friendCode)}. Again: ${spellCode(ctx.friendCode)}.`
          : 'Your friend code appears once you are online.',
      );

    case 'read.friend_requests': {
      const people = ctx.incomingRequests.map((request) => request.person.firstName || request.person.name);
      if (!people.length) return say('You have no friend requests.');
      return say(
        `${joinNames(people)} ${people.length === 1 ? 'wants' : 'want'} to be your friend. Say "accept ${people[0]}'s request" to accept.`,
      );
    }

    // ---- messages and friends
    case 'msg.send':
    case 'msg.reply': {
      // With the words: confirm and send. Without: ask for them first.
      const sendTo = (friend: Friend) => (slots.messageText ? confirmSend(friend, slots.messageText, ctx) : askMessage(friend, ctx));
      const here = intent === 'msg.reply' ? lastToMessage(ctx) : chatFriend(ctx);
      if (slots.friendName || here) {
        return withFriend(slots.friendName, ctx.friends, 'Who should I send it to?', sendTo, here);
      }
      if (intent === 'msg.reply') return say('Nobody has messaged you yet.');
      return {
        kind: 'ask',
        question: 'Who do you want to message?',
        answer: async (text) => withFriend(spokenName(text), ctx.friends, "I didn't catch the name. Okay, I cancelled that.", sendTo),
      };
    }

    case 'friend.add_code':
      if (!slots.friendCode) return say('Say the friend code letter by letter, for example "add friend code A B C D 2 3 4 5".');
      return {
        kind: 'confirm',
        question: `Send a friend request to code ${spellCode(slots.friendCode)}?`,
        run: async () => {
          try {
            const result = await apiFetch<{ status: string; person?: { firstName?: string; name?: string } }>('/friends/requests', {
              method: 'POST',
              body: JSON.stringify({ code: slots.friendCode }),
            });
            await ctx.refreshFriends();
            const who = result.person?.firstName || result.person?.name || 'them';
            return {
              say: result.status === 'accepted' ? `You and ${who} are now friends.` : `Friend request sent to ${who}. They need to accept it.`,
            };
          } catch (error) {
            return { say: errorText(error) };
          }
        },
      };

    case 'friend.accept_request':
    case 'friend.decline_request': {
      const accepting = intent === 'friend.accept_request';
      const requests = ctx.incomingRequests;
      if (!requests.length) return say('You have no friend requests.');
      const asFriends = requests.map(
        (request) => ({ userId: request.id, name: request.person.name, firstName: request.person.firstName }) as Friend,
      );
      const act = (request: FriendRequest): Plan => ({
        kind: 'confirm',
        question: `${accepting ? 'Accept' : 'Decline'} ${request.person.name}'s friend request?`,
        run: async () => {
          try {
            if (accepting) await apiFetch(`/friends/requests/${request.id}/accept`, { method: 'POST' });
            else await apiFetch(`/friends/requests/${request.id}`, { method: 'DELETE' });
            await ctx.refreshFriends();
            return { say: accepting ? `You and ${request.person.firstName || request.person.name} are now friends.` : 'Declined.' };
          } catch (error) {
            return { say: errorText(error) };
          }
        },
      });
      if (!slots.friendName) {
        if (requests.length === 1) return act(requests[0]);
        return say(`You have requests from ${joinNames(requests.map((r) => r.person.firstName || r.person.name))}. Say whose, for example "accept ${requests[0].person.firstName}'s request".`);
      }
      return withFriend(slots.friendName, asFriends, 'Whose request?', (match) => act(requests.find((r) => r.id === match.userId)!));
    }

    // ---- voice and text
    case 'speech.slower':
    case 'speech.faster': {
      const index = SPEECH_RATES.indexOf(ctx.prefs.speechRate);
      const next = SPEECH_RATES[index + (intent === 'speech.slower' ? -1 : 1)];
      if (!next) return say(intent === 'speech.slower' ? "That's already my slowest." : "That's already my fastest.");
      return {
        kind: 'confirm',
        question: intent === 'speech.slower' ? 'Make my voice slower?' : 'Make my voice faster?',
        run: async () => {
          ctx.setPref('speechRate', next);
          return { say: intent === 'speech.slower' ? 'Okay. I will speak slower.' : 'Okay. I will speak faster.' };
        },
      };
    }

    case 'text.bigger':
    case 'text.smaller': {
      const index = TEXT_SCALES.indexOf(ctx.prefs.textScale);
      const next = TEXT_SCALES[index + (intent === 'text.bigger' ? 1 : -1)];
      if (!next) return say(intent === 'text.bigger' ? 'The text is already at its biggest.' : 'The text is already at its smallest.');
      return {
        kind: 'confirm',
        question: intent === 'text.bigger' ? 'Make the text bigger?' : 'Make the text smaller?',
        run: async () => {
          ctx.setPref('textScale', next);
          return { say: intent === 'text.bigger' ? 'The text is bigger now.' : 'The text is smaller now.' };
        },
      };
    }

    case 'voice.change': {
      const value = slots.value;
      if (!value) return say('Say "use a man\'s voice", "use a woman\'s voice", or "use the normal voice".');
      const name = value === 'man' ? "a man's voice" : value === 'woman' ? "a woman's voice" : "the phone's normal voice";
      return {
        kind: 'confirm',
        question: `Read things aloud in ${name}?`,
        run: async () => {
          ctx.setPref('appVoice', value);
          return { say: `Okay. Messages will be read in ${name}. My own voice is set in Accel settings.` };
        },
      };
    }

    case 'blocked.account':
      return say('For your safety, I can’t do that by voice. You can do it yourself in the menu, or in Edit profile.');

    case 'none':
    default:
      return say('Sorry, I didn’t catch that. Say "what can I say" to hear what I can do.');
  }
}
