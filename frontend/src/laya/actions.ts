import { router, type Href } from 'expo-router';
import { apiFetch } from '@/api/apiClient';
import { labelOf, screenOf, type IntentId, type Slots } from '@/laya/catalog';
import { chatFriend, chatMessages, lineFor, nameOf, pageFromNewest, spokenAgo, unreadFrom } from '@/laya/chat';
import { matchFriend, spellCode, stripFillers } from '@/laya/language';
import { inLang, listOf, P, type Lang, type Line } from '@/laya/phrases';
import { currentScreen } from '@/laya/screenContext';
import { describeLive, describeScreen, screenExamples } from '@/laya/screens';
import { isOnlineNow, polishMessage } from '@/laya/understand';
import { friendRecentText } from '@/components/sos/RecentSosCard';
import { listConversations } from '@/db/conversations';
import { addPendingMessage, flushOutbox, getDirectMessages } from '@/db/directMessages';
import type { Friend } from '@/db/friends';
import type { Preferences, SpeechRate, TextScale } from '@/hooks/use-preferences';
import { allLessons } from '@/learn/lessons';
import { openLesson } from '@/learn/open';
import { courseProgress } from '@/learn/progress';
import type { Completion } from '@/learn/types';
import type { FriendRequest } from '@/realtime/FriendsProvider';
import { openSavedConversation, startNamedConversation } from '@/utils/conversationNav';
import { whenTextIn } from '@/utils/dates';
import type { FriendSos, MySos, SosMethod } from '@/utils/sos';
import { fetchRecentSos, loadRecentSos, saveRecentSos } from '@/utils/sos';
import { setSosCircle } from '@/utils/sosCircle';
import { goBack } from '@/utils/navigation';

/**
 * What Laya does for each command. Every plan is one of:
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
 * What Laya SAYS is always one of the fixed sentences in laya/phrases.ts,
 * in the language the command was said in (`ctx.lang`), filled in with
 * names and details — never text the AI wrote. And nothing here can delete
 * an account, sign out or unfriend anyone.
 */
export type Outcome = { say: string; after?: () => void; next?: Plan };

export type Plan =
  | { kind: 'say'; text: string }
  | { kind: 'confirm'; question: string; run: () => Promise<Outcome>; no?: () => Promise<Plan> }
  | { kind: 'do'; run: () => Promise<Outcome> }
  | { kind: 'choose'; question: string; options: { label: string; friend: Friend; plan: () => Promise<Plan> }[] }
  | { kind: 'ask'; question: string; answer: (text: string) => Promise<Plan> };

export type LayaContext = {
  pathname: string;
  /** The language the command was said in: Laya answers in it. */
  lang: Lang;
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
  /** How far back Laya has read in each chat (friend id → messages from the newest). */
  readPositions: Map<string, number>;
  /** Marks a chat read (here and for the friend). */
  markRead: (friendId: string) => Promise<void>;
  /** Friends' SOS still going. */
  friendSos: FriendSos[];
  userId: string | null;
  /** Learn progress, for "start the next lesson" and the Learn screen. */
  learn: { completions: Completion[] };
  /** Opens Big text, empty or showing these words. */
  showBigText: (text?: string) => void;
};

const SPEECH_RATES: SpeechRate[] = [0.75, 1, 1.25, 1.5];
const TEXT_SCALES: TextScale[] = [1, 1.15, 1.3, 1.5];

const say = (text: string): Plan => ({ kind: 'say', text });
const go = (href: Href) => () => router.navigate(href);
const errorText = (error: unknown, lang: Lang) => (error instanceof Error ? error.message : inLang(lang, P.errorTryAgain));

// Paths of screens added with Laya (typed routes catch up on the next `expo start`).
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
  'nav.settings_laya': '/settings/laya',
  'nav.emergency_contacts': '/emergency-contacts',
  'nav.profile': '/profile',
  'nav.laya_guide': '/laya-guide',
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
  lang: Lang,
  fallback: Friend | null = null,
): Promise<Plan> | Plan {
  if (!name || PRONOUN.test(name.trim())) return fallback ? next(fallback) : say(prompt);
  const match = matchFriend(name, people);
  if (!match) return say(inLang(lang, P.notAFriend(name)));
  if ('friend' in match) return next(match.friend);
  return {
    kind: 'choose',
    question: inLang(lang, P.whichOfThem(listOf(lang, match.choices.map((friend) => friend.name), 'or'))),
    options: match.choices.map((friend) => ({ label: friend.name, friend, plan: async () => next(friend) })),
  };
}

// What "Hey Laya" sounds like in a tip, when it's on.
const callLaya = (ctx: LayaContext) => (ctx.prefs.layaWakeWord ? inLang(ctx.lang, P.callLaya) : '');

/** A spoken answer cleaned up: "to Andrew" → "Andrew", "kay Ana" → "Ana". */
function spokenName(text: string): string {
  return stripFillers(text).replace(/^(to|si|kay|kina|ni|for|with)\s+/, '').trim();
}

/** "Tell him I'm outside", as the answer to "What do you want to tell…?" → "I'm outside". */
function spokenMessage(text: string): string {
  return text.trim().replace(/^(say|tell (him|her|them)|sabihin (mo )?(na)?)\s+(that\s+)?/i, '').trim() || text.trim();
}

/** "Send to Andrew: '…'?" — then sends (or saves it for when back online). `then` continues a walk-through. */
async function confirmSend(friend: Friend, raw: string, ctx: LayaContext, then?: () => Promise<Plan>): Promise<Plan> {
  const t = (line: Line) => inLang(ctx.lang, line);
  const text = await polishMessage(raw, ctx.prefs.layaSmart);
  const name = nameOf(friend);
  return {
    kind: 'confirm',
    question: t(P.sendTo(name, text)),
    run: async () => {
      await addPendingMessage(friend.userId, text);
      await flushOutbox().catch(() => {});
      return {
        say: (await isOnlineNow()) ? t(P.sentTo(name)) : t(P.savedForLater(name)),
        next: then ? await then() : undefined,
      };
    },
    no: then ? async () => ({ kind: 'do', run: async () => ({ say: t(P.wontSend), next: await then() }) }) : undefined,
  };
}

/** "What do you want to tell Andrew?" → the answer → confirm → send. */
function askMessage(friend: Friend, ctx: LayaContext, then?: () => Promise<Plan>): Plan {
  return {
    kind: 'ask',
    question: inLang(ctx.lang, P.whatToTell(nameOf(friend))),
    answer: async (text) => confirmSend(friend, spokenMessage(text), ctx, then),
  };
}

/**
 * Reads `count` messages of a chat (before the newest `skip`), oldest
 * first, then offers older ones. Marks the chat read.
 */
function readChat(friend: Friend, ctx: LayaContext, count: number, skip: number, words: { intro?: string; end?: string } = {}): Plan {
  const t = (line: Line) => inLang(ctx.lang, line);
  return {
    kind: 'do',
    run: async () => {
      const messages = await chatMessages(friend.userId, await isOnlineNow());
      const page = pageFromNewest(messages, count, skip);
      if (!page.length) {
        return { say: skip ? t(P.noOlderMessages) : t(P.notMessagedYet(nameOf(friend))) };
      }
      ctx.readPositions.set(friend.userId, skip + page.length);
      if (skip === 0 && friend.unread > 0) await ctx.markRead(friend.userId);
      const lines = page.map((message) => lineFor(message, friend, ctx.lang)).join(' ');
      const more = messages.length > skip + page.length;
      return {
        say: `${words.intro ?? ''}${lines}${words.end ?? ''}`,
        next:
          more && !words.end
            ? {
                kind: 'confirm',
                question: t(P.hearOlder),
                run: async () => ({ say: '', next: readChat(friend, ctx, 5, skip + page.length) }),
                no: async () => say(t(P.okay)),
              }
            : undefined,
      };
    },
  };
}

/** "Any new messages?": each friend's new messages, then "Reply to Andrew?", then the next friend. */
function inboxStep(list: Friend[], index: number, ctx: LayaContext, extra: string): Plan {
  const t = (line: Line) => inLang(ctx.lang, line);
  if (index >= list.length) return say(t(P.allNewMessagesRead(extra)));
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
      const intro = index === 0 ? t(P.newMessagesFrom(listOf(ctx.lang, list.map(nameOf)))) : '';
      const lines = fresh.length ? fresh.map((message) => lineFor(message, friend, ctx.lang)).join(' ') : t(P.friendMessagedYou(name));
      return {
        say: intro + lines,
        next: {
          kind: 'confirm',
          question: t(P.replyTo(name)),
          run: async () => ({ say: '', next: askMessage(friend, ctx, nextStep) }),
          no: nextStep,
        },
      };
    },
  };
}

/** Who "reply" answers: the open chat, else whoever messaged last. */
function lastToMessage(ctx: LayaContext): Friend | null {
  const open = chatFriend(ctx);
  if (open) return open;
  const theirs = ctx.friends.filter((friend) => friend.lastMessage && !friend.lastMessage.fromMe);
  theirs.sort((a, b) => (b.lastMessage?.createdAt ?? 0) - (a.lastMessage?.createdAt ?? 0));
  return theirs[0] ?? null;
}

/** A screen command asked somewhere else: where it works, and how to get there. */
function elsewhere(where: string, ctx: LayaContext): Plan {
  const how = where === 'Conversation mode' ? P.howToReachConversation : where === 'Chats' ? P.howToReachChats : P.howToReachLesson;
  return say(inLang(ctx.lang, P.elsewhere(where, `${callLaya(ctx)}${inLang(ctx.lang, how)}`)));
}

/** "You're on Home. You have 3 saved conversations…" — what the screen shows right now. */
async function screenNow(ctx: LayaContext): Promise<string> {
  const registered = currentScreen();
  const friend = chatFriend(ctx);
  const screen = describeScreen(ctx.pathname, friend ? nameOf(friend) : null, ctx.lang);
  const live = registered ? await registered.describe(ctx.lang) : await describeLive(ctx);
  return inLang(ctx.lang, P.youAreOn(registered?.name ?? screen.name, live ?? screen.tips));
}

/** Each friend's latest SOS this week: from the server when online, else the copy Home saved. */
async function recentSos(ctx: LayaContext) {
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

export async function planFor(intent: IntentId, slots: Slots, ctx: LayaContext): Promise<Plan> {
  const lang = ctx.lang;
  const t = (line: Line) => inLang(lang, line);
  const label = labelOf(intent, lang);

  // ---- this screen's own commands (Chats, Conversation mode, a Learn lesson)
  const own = currentScreen()?.commands[intent];
  if (own) return own(slots, lang);
  const where = screenOf(intent);
  if (where && intent !== 'conv.start') return elsewhere(where, ctx);

  // ---- going places: say where, then go there
  const path = SCREEN[intent];
  if (path) {
    return {
      kind: 'confirm',
      question: t(P.takeYouTo(label)),
      run: async () => ({ say: t(P.opening(label)), after: go(path as Href) }),
    };
  }

  switch (intent) {
    case 'nav.conversation':
      return {
        kind: 'confirm',
        question: t(P.takeYouTo('Conversation mode')),
        run: async () => ({
          say: t(P.openingConversation),
          after: () =>
            router.navigate({ pathname: '/conversation', params: { action: 'listen', opened: String(Date.now()) } }),
        }),
      };

    case 'nav.back':
      return {
        kind: 'confirm',
        question: t(P.goBackQuestion),
        run: async () => ({ say: t(P.goingBack), after: () => goBack() }),
      };

    case 'nav.add_friend':
      return {
        kind: 'confirm',
        question: t(P.takeYouTo('Add a friend')),
        run: async () => ({
          say: ctx.friendCode ? t(P.openingAddFriend(spellCode(ctx.friendCode))) : t(P.openingAddFriendNoCode),
          after: go('/friends/add'),
        }),
      };

    // ---- Big text and the sign camera (Home's cards)
    case 'nav.big_text':
      return { kind: 'do', run: async () => ({ say: t(P.bigTextOpening), after: () => ctx.showBigText() }) };

    case 'text.show_big': {
      const words = slots.messageText?.trim();
      if (!words) return planFor('nav.big_text', {}, ctx);
      // No question first: showing words is harmless, and the person may be
      // in a hurry ("I need to pee"). Closing it is one tap.
      return { kind: 'do', run: async () => ({ say: t(P.bigTextShowing(words)), after: () => ctx.showBigText(words) }) };
    }

    case 'nav.sign_camera':
      return {
        kind: 'confirm',
        question: t(P.takeYouTo(label)),
        run: async () => ({ say: t(P.signCameraOpening), after: go('/sign-camera' as Href) }),
      };

    case 'nav.chat_with':
      return withFriend(
        slots.friendName,
        ctx.friends,
        t(P.whichFriendChat),
        (friend) => ({
          kind: 'confirm',
          question: t(P.openChatQuestion(friend.name)),
          run: async () => ({
            say: '',
            after: () => router.navigate({ pathname: '/chat/[friendId]', params: { friendId: friend.userId } }),
            // Then hear it: the last 3 messages, and how to go on.
            next: readChat(friend, ctx, 3, 0, {
              intro: t(P.chatIntro(nameOf(friend))),
              end: t(P.chatHowToGoOn(callLaya(ctx))),
            }),
          }),
        }),
        lang,
      );

    // ---- emergency
    case 'sos.send':
      if (!ctx.sosAvailable) return say(t(P.sosOnlyPwd));
      // The countdown is the confirmation: it can still be cancelled.
      return { kind: 'do', run: async () => ({ say: '', after: () => ctx.startSos('voice') }) };

    case 'sos.im_safe':
      if (!ctx.mySos && !ctx.sosPending) return say(t(P.noSosGoing));
      if (!ctx.mySos) {
        return {
          kind: 'confirm',
          question: t(P.cancelUnsentSos),
          run: async () => {
            await ctx.markSafe();
            return { say: t(P.sosWontSend) };
          },
        };
      }
      return {
        kind: 'confirm',
        question: t(P.endSosQuestion),
        run: async () => {
          try {
            await ctx.markSafe();
            return { say: t(P.sosEnded) };
          } catch (error) {
            return { say: errorText(error, lang) };
          }
        },
      };

    case 'sos.circle_add':
    case 'sos.circle_remove': {
      const adding = intent === 'sos.circle_add';
      return withFriend(
        slots.friendName,
        ctx.friends,
        t(P.whichFriend),
        (friend) => ({
          kind: 'confirm',
          question: adding ? t(P.circleAddQuestion(friend.name)) : t(P.circleRemoveQuestion(friend.name)),
          run: async () => {
            try {
              await setSosCircle(friend.userId, adding);
              await ctx.refreshFriends();
              return { say: adding ? t(P.circleAdded(friend.firstName)) : t(P.circleRemoved(friend.firstName)) };
            } catch (error) {
              return { say: errorText(error, lang) };
            }
          },
        }),
        lang,
      );
    }

    // ---- reading things aloud
    case 'read.new_messages': {
      const unread = ctx.friends.filter((friend) => friend.unread > 0);
      const requests = ctx.incomingRequests.length;
      const extra = requests ? t(P.alsoRequests(requests)) : '';
      if (!unread.length) return say(t(P.noNewMessages(extra)));
      return inboxStep(unread, 0, ctx, extra);
    }

    case 'read.chat_with':
      return withFriend(slots.friendName, ctx.friends, t(P.whoseChat), (friend) => readChat(friend, ctx, 5, 0), lang, chatFriend(ctx));

    case 'read.older_messages':
      return withFriend(
        slots.friendName,
        ctx.friends,
        t(P.openAChatFirst),
        (friend) => readChat(friend, ctx, 5, ctx.readPositions.get(friend.userId) ?? 0),
        lang,
        chatFriend(ctx),
      );

    case 'read.my_last_message':
      return withFriend(
        slots.friendName,
        ctx.friends,
        t(P.toWhom),
        async (friend) => {
          const messages = await chatMessages(friend.userId, await isOnlineNow());
          const mine = [...messages].reverse().find((message) => message.fromMe);
          if (!mine) return say(t(P.notSentYet(nameOf(friend))));
          const waiting = mine.status === 'pending' ? t(P.waitingToSend) : '';
          return say(t(P.youSaidTo(nameOf(friend), spokenAgo(mine.createdAt, lang), mine.body)) + waiting);
        },
        lang,
        chatFriend(ctx),
      );

    case 'read.last_message_from':
      return withFriend(
        slots.friendName,
        ctx.friends,
        t(P.whoseMessage),
        async (friend) => {
          const messages = await getDirectMessages(friend.userId);
          const last = [...messages].reverse().find((message) => !message.fromMe);
          if (!last) return say(t(P.noMessagesFrom(friend.firstName || friend.name)));
          const minutes = Math.round((Date.now() - last.createdAt) / 60000);
          const when = minutes < 1 ? t(P.justNow) : minutes < 60 ? t(P.minutesAgo(minutes)) : t(P.earlier);
          return say(
            last.kind === 'sos'
              ? t(P.friendSentSos(friend.firstName, when, last.body))
              : t(P.friendSaid(friend.firstName || friend.name, when, last.body)),
          );
        },
        lang,
        chatFriend(ctx),
      );

    case 'read.who_online': {
      if (!ctx.connected) return say(t(P.cantTellOnline));
      const online = ctx.friends.filter((friend) => friend.online).map((friend) => friend.firstName || friend.name);
      return say(online.length ? t(P.areOnline(online, lang)) : t(P.noneOnline));
    }

    case 'read.where_am_i':
    case 'read.screen':
      return say(await screenNow(ctx));

    // "What can I do here": this screen's commands first, then the ones that work everywhere.
    case 'read.help': {
      const registered = currentScreen();
      const friend = chatFriend(ctx);
      const name = registered?.name ?? describeScreen(ctx.pathname, friend ? nameOf(friend) : null, lang).name;
      const examples = (registered?.examples(lang) ?? screenExamples(ctx)).slice(0, 6);
      const here = examples.length ? t(P.helpHere(name, examples.join('. '))) : '';
      return say(`${here}${t(P.helpEverywhere)}`);
    }

    case 'read.recent_sos': {
      const found = await recentSos(ctx);
      if (!found) return say(t(P.cantCheckRecentSos));
      const { friends, mine } = found.list;
      const lines = friends.map((sos) => `${sos.name}: ${friendRecentText(sos, ctx.userId)}${sos.active ? t(P.stillGoing) : ''}`);
      if (mine) lines.push(t(P.yourLastSos(whenTextIn(lang, mine.occurredAt ?? mine.createdAt), mine.active)));
      if (!lines.length) return say(t(P.noSosThisWeek));
      const old = found.savedAt ? t(P.savedFrom(whenTextIn(lang, found.savedAt))) : '';
      return say(`${lines.join(' ')}${old}`);
    }

    case 'nav.last_conversation': {
      const [latest] = await listConversations();
      if (!latest) return say(t(P.noConversationsYet(callLaya(ctx))));
      return {
        kind: 'confirm',
        question: t(P.openLastConversation(latest.title)),
        run: async () => ({ say: t(P.opening(latest.title)), after: () => openSavedConversation(latest.id) }),
      };
    }

    // Anywhere but Conversation mode itself (that screen handles it).
    case 'conv.start': {
      const name = slots.friendName;
      if (!name) return planFor('nav.conversation', {}, ctx);
      return {
        kind: 'confirm',
        question: t(P.startNamedQuestion(name)),
        run: async () => ({ say: t(P.startingNamed(name)), after: () => startNamedConversation(name) }),
      };
    }

    case 'learn.next_lesson': {
      if (!ctx.prefs.signLanguageChosen) {
        return {
          kind: 'confirm',
          question: t(P.pickSignLanguageFirst),
          run: async () => ({ say: t(P.opening('Learn')), after: go('/learn') }),
        };
      }
      const course = ctx.prefs.signLanguage;
      const progress = courseProgress(course, ctx.learn.completions);
      const lesson = progress.next ? allLessons(course).find((l) => l.id === progress.next) : null;
      if (!lesson) return say(t(P.finishedEveryLevel));
      const teaches = lesson.kind === 'review' ? t(P.reviewTeaches) : t(P.lessonTeaches(listOf(lang, lesson.signs.map((sign) => sign.display))));
      return {
        kind: 'confirm',
        question: t(P.startLessonQuestion(lesson.title, lesson.unitTitle, teaches)),
        run: async () => ({ say: t(P.startingLesson(lesson.title)), after: () => openLesson(lesson.id) }),
      };
    }

    case 'learn.practice':
      return {
        kind: 'confirm',
        question: t(P.takeYouTo(label)),
        run: async () => ({ say: t(P.opening('Practice')), after: go('/learn-practice' as Href) }),
      };

    case 'blocked.outside':
      return say(t(P.onlyInsideAccessAI));

    case 'read.repeat':
      return say(ctx.lastSpoken ?? t(P.nothingSaidYet));

    case 'read.my_friend_code':
      return say(ctx.friendCode ? t(P.yourFriendCode(spellCode(ctx.friendCode))) : t(P.friendCodeOnceOnline));

    case 'read.friend_requests': {
      const people = ctx.incomingRequests.map((request) => request.person.firstName || request.person.name);
      if (!people.length) return say(t(P.noFriendRequests));
      return say(t(P.wantToBeFriends(people, people[0], lang)));
    }

    // ---- messages and friends
    case 'msg.send':
    case 'msg.reply': {
      // With the words: confirm and send. Without: ask for them first.
      const sendTo = (friend: Friend) => (slots.messageText ? confirmSend(friend, slots.messageText, ctx) : askMessage(friend, ctx));
      const here = intent === 'msg.reply' ? lastToMessage(ctx) : chatFriend(ctx);
      if (slots.friendName || here) {
        return withFriend(slots.friendName, ctx.friends, t(P.whoToSendTo), sendTo, lang, here);
      }
      if (intent === 'msg.reply') return say(t(P.nobodyMessaged));
      return {
        kind: 'ask',
        question: t(P.whoToMessage),
        answer: async (text) => withFriend(spokenName(text), ctx.friends, t(P.nameNotCaught), sendTo, lang),
      };
    }

    case 'friend.add_code':
      if (!slots.friendCode) return say(t(P.sayTheCode));
      return {
        kind: 'confirm',
        question: t(P.sendRequestTo(spellCode(slots.friendCode))),
        run: async () => {
          try {
            const result = await apiFetch<{ status: string; person?: { firstName?: string; name?: string } }>('/friends/requests', {
              method: 'POST',
              body: JSON.stringify({ code: slots.friendCode }),
            });
            await ctx.refreshFriends();
            const who = result.person?.firstName || result.person?.name || t(P.someone);
            return { say: result.status === 'accepted' ? t(P.nowFriends(who)) : t(P.requestSent(who)) };
          } catch (error) {
            return { say: errorText(error, lang) };
          }
        },
      };

    case 'friend.accept_request':
    case 'friend.decline_request': {
      const accepting = intent === 'friend.accept_request';
      const requests = ctx.incomingRequests;
      if (!requests.length) return say(t(P.noFriendRequests));
      const asFriends = requests.map(
        (request) => ({ userId: request.id, name: request.person.name, firstName: request.person.firstName }) as Friend,
      );
      const act = (request: FriendRequest): Plan => ({
        kind: 'confirm',
        question: accepting ? t(P.acceptQuestion(request.person.name)) : t(P.declineQuestion(request.person.name)),
        run: async () => {
          try {
            if (accepting) await apiFetch(`/friends/requests/${request.id}/accept`, { method: 'POST' });
            else await apiFetch(`/friends/requests/${request.id}`, { method: 'DELETE' });
            await ctx.refreshFriends();
            return { say: accepting ? t(P.nowFriends(request.person.firstName || request.person.name)) : t(P.declined) };
          } catch (error) {
            return { say: errorText(error, lang) };
          }
        },
      });
      if (!slots.friendName) {
        if (requests.length === 1) return act(requests[0]);
        const names = requests.map((r) => r.person.firstName || r.person.name);
        return say(t(P.requestsFrom(listOf(lang, names), names[0])));
      }
      return withFriend(slots.friendName, asFriends, t(P.whoseRequest), (match) => act(requests.find((r) => r.id === match.userId)!), lang);
    }

    // ---- voice and text
    case 'speech.slower':
    case 'speech.faster': {
      const slower = intent === 'speech.slower';
      const index = SPEECH_RATES.indexOf(ctx.prefs.speechRate);
      const next = SPEECH_RATES[index + (slower ? -1 : 1)];
      if (!next) return say(slower ? t(P.alreadySlowest) : t(P.alreadyFastest));
      return {
        kind: 'confirm',
        question: slower ? t(P.slowerQuestion) : t(P.fasterQuestion),
        run: async () => {
          ctx.setPref('speechRate', next);
          return { say: slower ? t(P.slowerDone) : t(P.fasterDone) };
        },
      };
    }

    case 'text.bigger':
    case 'text.smaller': {
      const bigger = intent === 'text.bigger';
      const index = TEXT_SCALES.indexOf(ctx.prefs.textScale);
      const next = TEXT_SCALES[index + (bigger ? 1 : -1)];
      if (!next) return say(bigger ? t(P.alreadyBiggest) : t(P.alreadySmallest));
      return {
        kind: 'confirm',
        question: bigger ? t(P.biggerQuestion) : t(P.smallerQuestion),
        run: async () => {
          ctx.setPref('textScale', next);
          return { say: bigger ? t(P.biggerDone) : t(P.smallerDone) };
        },
      };
    }

    case 'voice.change': {
      const value = slots.value;
      if (!value) return say(t(P.voiceHowTo));
      const name = t(value === 'man' ? P.voiceMan : value === 'woman' ? P.voiceWoman : P.voiceNormal);
      return {
        kind: 'confirm',
        question: t(P.voiceQuestion(name)),
        run: async () => {
          ctx.setPref('appVoice', value);
          return { say: t(P.voiceDone(name)) };
        },
      };
    }

    case 'blocked.account':
      return say(t(P.blockedAccount));

    case 'none':
    default:
      return say(t(P.didntCatch));
  }
}
