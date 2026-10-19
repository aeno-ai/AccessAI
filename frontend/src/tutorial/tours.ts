/**
 * The first-time tutorial's steps, page by page (owner, 2026-10-17,
 * HANDOFF.md §40). Each step lights up one control (`target`, see
 * targets.ts) — or none, when there's nothing to point at — with a title
 * and one or two short, plain sentences: what it is and what you can do
 * with it. No imports, so the check scripts can load it.
 */
export type TourId = 'home' | 'conversation' | 'friends' | 'add-friend' | 'learn' | 'settings';

export type TourContext = {
  /** A PWD account (only they have the SOS button). */
  pwd: boolean;
  /** Laya is switched on (her button is on screen). */
  layaOn: boolean;
  /** There are quick replies (Conversation shows the Replies button). */
  hasQuickReplies: boolean;
};

export type TourStep = {
  target?: string;
  title: string;
  text: string;
  /** Left out when this is false. */
  when?: (context: TourContext) => boolean;
};

export const TOURS: Record<TourId, TourStep[]> = {
  home: [
    {
      target: 'home.menu',
      title: 'Your account',
      text: 'Tap here for your account: edit your profile, your emergency contacts, the Terms, and signing out.',
    },
    {
      target: 'home.greeting',
      title: 'Start a conversation',
      text: 'Talk with someone next to you — by voice, typing or sign language.',
    },
    {
      target: 'home.cards',
      title: 'Shortcuts',
      text: 'Big text shows words large for someone to read. Sign language reads your signs and says them out loud. Quick replies say a saved phrase in one tap. Learn signs teaches you sign language.',
    },
    {
      target: 'laya.button',
      title: 'Laya, your voice assistant',
      text: 'Tap here or say “Hey Laya” to move around the app by voice. You can drag this button anywhere.',
      when: (context) => context.layaOn,
    },
    {
      title: 'Laya, your voice assistant',
      text: 'Laya helps you use the app by voice. You can turn her on in Settings, Laya.',
      when: (context) => !context.layaOn,
    },
    {
      target: 'home.sos',
      title: 'Emergency SOS',
      text: 'Hold this button to send an SOS with where you are to the friends in your SOS circle.',
      when: (context) => context.pwd,
    },
    {
      target: 'home.tabs',
      title: 'The main pages',
      text: 'Home, Chats, Friends, Learn and Settings are always down here.',
    },
    {
      target: 'home.recent',
      title: 'Recent conversations',
      text: 'Your last conversations show here. Tap one to go back to it.',
    },
  ],
  conversation: [
    {
      target: 'conv.speaker',
      title: 'Who is talking',
      text: 'Pick Me when you talk, and Them when the other person talks, so every message is saved under the right person.',
    },
    {
      target: 'conv.sign',
      title: 'Sign language',
      text: 'Turns on the camera, so signs become words in the message box.',
    },
    {
      target: 'conv.replies',
      title: 'Quick replies',
      text: 'Your saved phrases. Tap one to say it right away.',
      when: (context) => context.hasQuickReplies,
    },
    {
      target: 'conv.mic',
      title: 'Microphone',
      text: 'Tap to speak. What is said turns into text.',
    },
    {
      title: 'Hear a message',
      text: 'Tap the speaker on any message to hear it read aloud.',
    },
    {
      title: 'Saved for later',
      text: 'Every conversation is saved in Chats, so you can go back to it any time.',
    },
  ],
  friends: [
    {
      title: 'Your friends',
      text: 'Chat with your friends online here, with the same tools as Conversation.',
    },
    {
      target: 'friends.add',
      title: 'Add a friend',
      text: 'Tap here to see your QR code and friend code, or to add someone with theirs.',
    },
  ],
  'add-friend': [
    {
      target: 'addFriend.code',
      title: 'Your code',
      text: 'Your QR code and friend code. A friend scans the QR code or types the code to add you.',
    },
    {
      target: 'addFriend.share',
      title: 'Share my code',
      text: 'Sends your friend code by text or a chat app.',
    },
    {
      target: 'addFriend.input',
      title: 'Add someone',
      text: "Type a friend's code here, then send them a friend request.",
    },
    {
      target: 'addFriend.scan',
      title: 'Scan a QR code',
      text: "Point the camera at a friend's QR code to add them.",
    },
  ],
  learn: [
    {
      target: 'learn.switch',
      title: 'Pick a sign language',
      text: 'Switch between Filipino Sign Language (FSL) and American Sign Language (ASL). Each keeps its own progress.',
    },
    {
      target: 'learn.continue',
      title: 'Your next lesson',
      text: 'Start your next lesson here. Each one teaches a few signs with videos and steps.',
    },
    {
      target: 'learn.links',
      title: 'More',
      text: 'See the leaderboard with your friends, practise signs with the camera, or see where the videos come from.',
    },
    {
      target: 'learn.units',
      title: 'Lessons',
      text: 'Lessons open one after another. A review at the end goes over the whole unit.',
    },
  ],
  settings: [
    {
      target: 'settings.needs',
      title: 'My needs',
      text: 'Tell AccessAI what you need — blind or low vision, deaf or hard of hearing, or mute — and it sets things up for you.',
    },
    {
      target: 'settings.laya',
      title: 'Laya',
      text: 'Laya is an assistant that helps you use the app by voice. Turn her on or off, and choose her voice.',
    },
    {
      target: 'settings.display',
      title: 'Display & text',
      text: 'Make the text bigger or bolder, and change the colors.',
    },
    {
      target: 'settings.speech',
      title: 'Conversation & speech',
      text: 'Choose what is read aloud, which voice, and how fast it speaks.',
    },
    {
      target: 'settings.sign',
      title: 'Sign language',
      text: 'Pick FSL or ASL, words or letters, and set up the camera.',
    },
    {
      target: 'settings.replies',
      title: 'Quick replies',
      text: 'Add or change the phrases you say often.',
    },
  ],
};

/** The steps of a tour for this person. */
export function stepsFor(id: TourId, context: TourContext): TourStep[] {
  return TOURS[id].filter((step) => !step.when || step.when(context));
}
