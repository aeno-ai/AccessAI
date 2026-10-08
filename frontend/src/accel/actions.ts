import { router, type Href } from 'expo-router';
import { apiFetch } from '@/api/apiClient';
import { INTENTS, type IntentId, type Slots } from '@/accel/catalog';
import { matchFriend, spellCode } from '@/accel/language';
import { describeScreen } from '@/accel/screens';
import { isOnlineNow, polishMessage } from '@/accel/understand';
import { addPendingMessage, flushOutbox, getDirectMessages } from '@/db/directMessages';
import type { Friend } from '@/db/friends';
import type { Preferences, SpeechRate, TextScale } from '@/hooks/use-preferences';
import type { FriendRequest } from '@/realtime/FriendsProvider';
import type { MySos, SosMethod } from '@/utils/sos';
import { joinNames } from '@/utils/sos';
import { setSosCircle } from '@/utils/sosCircle';

/**
 * What Accel does for each command. Every plan is one of:
 * - say:     just answer (reading things aloud)
 * - confirm: ask a yes/no question first; only "yes" runs it
 * - do:      act straight away (only the SOS, whose countdown can be cancelled)
 * - choose:  "Which Ana?" — then the answer picks one of the options
 *
 * What Accel SAYS is always one of the fixed sentences below, filled in
 * with names and details — never text the AI wrote. And nothing here can
 * delete an account, sign out or unfriend anyone.
 */
export type Outcome = { say: string; after?: () => void };

export type Plan =
  | { kind: 'say'; text: string }
  | { kind: 'confirm'; question: string; run: () => Promise<Outcome> }
  | { kind: 'do'; run: () => Promise<Outcome> }
  | { kind: 'choose'; question: string; options: { label: string; friend: Friend; plan: () => Promise<Plan> }[] };

export type AccelContext = {
  pathname: string;
  friends: Friend[];
  connected: boolean;
  incomingRequests: FriendRequest[];
  friendCode: string | null;
  refreshFriends: () => Promise<Friend[]>;
  sosAvailable: boolean;
  mySos: MySos | null;
  startSos: (method: SosMethod) => void;
  markSafe: () => Promise<void>;
  prefs: Preferences;
  setPref: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  lastSpoken: string | null;
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

/** Finds the friend, or asks which one, or says nobody matched. */
function withFriend(
  name: string | undefined,
  people: Friend[],
  prompt: string,
  next: (friend: Friend) => Promise<Plan> | Plan,
): Promise<Plan> | Plan {
  if (!name) return say(prompt);
  const match = matchFriend(name, people);
  if (!match) return say(`I couldn't find ${name} among your friends.`);
  if ('friend' in match) return next(match.friend);
  return {
    kind: 'choose',
    question: `Which one: ${joinNames(match.choices.map((friend) => friend.name)).replace(' and ', ' or ')}?`,
    options: match.choices.map((friend) => ({ label: friend.name, friend, plan: async () => next(friend) })),
  };
}

export async function planFor(intent: IntentId, slots: Slots, ctx: AccelContext): Promise<Plan> {
  const label = INTENTS[intent].label;

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
        run: async () => ({ say: 'Going back.', after: () => (router.canGoBack() ? router.back() : router.navigate('/')) }),
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
          say: `Opening your chat with ${friend.firstName || friend.name}.`,
          after: () => router.navigate({ pathname: '/chat/[friendId]', params: { friendId: friend.userId } }),
        }),
      }));

    // ---- emergency
    case 'sos.send':
      if (!ctx.sosAvailable) return say('Sending an SOS is only for PWD accounts.');
      // The countdown is the confirmation: it can still be cancelled.
      return { kind: 'do', run: async () => ({ say: '', after: () => ctx.startSos('voice') }) };

    case 'sos.im_safe':
      if (!ctx.mySos) return say("You don't have an SOS going right now.");
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
      const parts = unread.map((friend) => `${friend.unread} from ${friend.firstName || friend.name}`);
      const requests = ctx.incomingRequests.length;
      const messages = unread.length
        ? `You have new messages: ${joinNames(parts)}.`
        : 'No new messages.';
      const extra = requests ? ` And ${requests} friend ${requests === 1 ? 'request' : 'requests'}.` : '';
      const hint = unread.length === 1 ? ` Say "read ${unread[0].firstName}'s last message" to hear it.` : '';
      return say(messages + extra + hint);
    }

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
      });

    case 'read.who_online': {
      if (!ctx.connected) return say("I can't tell who's online while you're offline.");
      const online = ctx.friends.filter((friend) => friend.online).map((friend) => friend.firstName || friend.name);
      return say(online.length ? `${joinNames(online)} ${online.length === 1 ? 'is' : 'are'} online.` : 'None of your friends are online right now.');
    }

    case 'read.where_am_i': {
      const chatId = ctx.pathname.startsWith('/chat/') ? ctx.pathname.split('/')[2] : null;
      const friend = chatId ? ctx.friends.find((f) => f.userId === chatId) : null;
      const screen = describeScreen(ctx.pathname, friend?.firstName ?? friend?.name);
      return say(`You're on ${screen.name}. ${screen.tips}`);
    }

    case 'read.help':
      return say(
        'You can say things like: take me to conversation mode. Any new messages? Tell Ana I\'m on my way. Add a friend. Where am I? Or, in an emergency: SOS. Say "show me what you can do" for the full list.',
      );

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
      if (!slots.messageText) return say('What should I send? For example, say "tell Ana I\'m on my way".');
      return withFriend(slots.friendName, ctx.friends, 'Who should I send it to?', async (friend) => {
        const text = await polishMessage(slots.messageText!, ctx.prefs.accelSmart);
        return {
          kind: 'confirm',
          question: `Send to ${friend.firstName || friend.name}: "${text}"?`,
          run: async () => {
            await addPendingMessage(friend.userId, text);
            await flushOutbox().catch(() => {});
            return {
              say: (await isOnlineNow())
                ? `Sent to ${friend.firstName || friend.name}.`
                : `Saved. It will send to ${friend.firstName || friend.name} when you're back online.`,
            };
          },
        };
      });

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
      return say('For your safety, I can’t do that by voice. You can do it yourself from the menu.');

    case 'none':
    default:
      return say('Sorry, I didn’t catch that. Say "what can I say" to hear what I can do.');
  }
}
