// Everything the user agrees to at sign-up lives here, so the wording can be
// edited in one place. Whenever it changes, bump TERMS_VERSION here AND in
// backend/src/constants/legal.js — the backend stamps each account with the
// version it agreed to.
export const TERMS_VERSION = '2026-10-17';

// Must match DELETION_GRACE_DAYS in backend/src/constants/legal.js.
export const DELETION_GRACE_DAYS = 15;

// Must match ADMIN_DELETION_DAYS and ACTIVITY_RETENTION_DAYS in
// backend/src/constants/legal.js.
export const ADMIN_DELETION_DAYS = 30;
export const ACTIVITY_RETENTION_DAYS = 90;

/**
 * A section of the terms. Each block is either a paragraph (a string) or a
 * bulleted list (an array of strings).
 */
export type TermsSection = {
  heading: string;
  blocks: (string | string[])[];
};

// Written as us, the AccessAI team: "we", casual and plain.
export const TERMS_INTRO =
  "Please read this before you make your account. When you tick the box on the sign-up screen, you agree to these terms and to how we handle your information, as written below.";

export const TERMS_SECTIONS: TermsSection[] = [
  {
    heading: '1. About AccessAI',
    blocks: [
      'AccessAI helps persons with disabilities (PWDs) talk with the people around them and get help fast, together with the family and friends who support them.',
    ],
  },
  {
    heading: '2. Your account',
    blocks: [
      [
        "Tell us the truth when you sign up, including whether you're signing up as a PWD.",
        'Keep your password, your email and (if you sign in with it) your Google account to yourself. What happens on your account is your responsibility.',
        "If you're under 18, a parent or guardian has to agree to these terms for you.",
        'Use AccessAI fairly: no spam, no bothering or harassing people, no fake SOS alerts, and no trying to break or overload the app.',
      ],
    ],
  },
  {
    heading: '3. What we collect',
    blocks: [
      [
        'Account details: your name, email and account type (PWD or non-PWD). Being a PWD is sensitive personal information under the Data Privacy Act, so we treat it with extra care.',
        "Your password, if you set one. We only keep it scrambled (hashed), so even we can't read it.",
        "If you continue with Google: your name and email from your Google account, and the ID Google gives it. We never see your Google password.",
        'Emergency contacts you add: their name, phone number, relationship and, if you want, their email. Only add people who said yes to being your emergency contact.',
        "Your conversations: their titles and messages. They're saved on your phone and backed up to our server when you're online.",
        "Friends and chats: your friend code, who your friends are, the messages you send them, whether you're online, and a note for friends if you write one. Your note only mentions a disability if you choose to write that.",
        "SOS alerts: when you send one, the time, the message, the place name your phone looks up and, only if you allow location, where you are. Your location keeps updating for up to 30 minutes while AccessAI is open, or until you say you're safe; we only keep the newest one. We also keep which friends answered (\"seen\" or \"on my way\").",
        "Login and activity records: when you sign up, log in or out, fail to log in, change your password or email, ask to delete your account, or hit one of our limits (like sending too many messages or friend requests at once). Each record has your network (IP) address, your phone type and your AccessAI version.",
        'Learn: the lessons you finish, so you can see your progress and how you rank with your friends this week.',
        'Notification address: if you allow notifications, the address (push token) that lets us send your phone SOS alerts and messages while AccessAI is closed.',
        'Your settings (like text size, colors and your chosen needs). These stay on your phone.',
      ],
    ],
  },
  {
    heading: '4. How we use it',
    blocks: [
      'We only use your information to:',
      [
        'make and run your account, check your email and sign you in;',
        'fit AccessAI to your account type;',
        'back up your conversations;',
        "send your messages to your friends and show them when you're online;",
        'alert the friends in your SOS circle when you send an SOS, and help you text your emergency contacts;',
        'keep AccessAI safe, and spot spam, break-in attempts and misuse (like many failed logins in a row).',
      ],
      "We don't sell your information or use it for ads. We only share it with the services that help us run AccessAI: the cloud database that stores it, the email service that sends your sign-in codes, and Expo, Google and Apple, who deliver notifications to your phone. If you continue with Google, Google knows you signed in to AccessAI. Reading text aloud happens on your phone.",
      "When you use the microphone, your phone turns speech into text on the phone itself when it can. If it can't, what's said goes to your phone's speech service (Apple's or Google's) to be turned into text. We never get or keep the audio; only the text you choose to send is saved.",
      'Laya, the voice assistant: "Hey Laya" only listens while AccessAI is open, and it works the same way as the microphone: your phone turns what it hears into text on the phone when it can, and otherwise uses your phone\'s speech service. We never get or keep the audio. When "Smarter understanding" is on and you\'re online, the words of a command (not the audio) go to our server, where our own AI works out what you asked for. The same AI can tidy a message before you send it. We don\'t keep anything you say to Laya.',
      "Sign language: while sign mode or the sign language camera is on, short video clips from the camera go to our server to read the signs, and our AI can turn them into a sentence. Each clip is read and then deleted right away. We don't keep any video.",
    ],
  },
  {
    heading: '5. Who can see it',
    blocks: [
      "You can see all of your own information. Your friends can see your name, your note for friends, whether you're online, the messages you send them, and how many lessons you finished this week on the Learn leaderboard. They never see your email or account type. Friends in your SOS circle get your SOS message and location when you send an SOS. People can only add you as a friend with your friend code.",
      "Our admins (the AccessAI team members who run the app) can see your name, email, account type and account status. To keep AccessAI safe, they can also see your login and activity records, and your SOS records: when you sent one, whether it was a test, how many friends were alerted, who answered and when, and when you were marked safe or it ran out. They never see where you were, the place name or the SOS message. They also can't see your password, conversations, chats or emergency contacts.",
      'Every time an admin opens your records or changes your account, we log it.',
    ],
  },
  {
    heading: '6. If someone misuses AccessAI',
    blocks: [
      'If we see spam, harassment, fake SOS alerts or other misuse, an admin can:',
      [
        "pause (suspend) the account for 1, 7 or 30 days. When you try to log in, you'll see until when and why;",
        `delete the account in ${ADMIN_DELETION_DAYS} days. It's locked right away, and after ${ADMIN_DELETION_DAYS} days it's erased like any deleted account. Only we can undo this.`,
      ],
      "While an account is paused or locked, its friends don't see it. If you think we made a mistake, contact us.",
    ],
  },
  {
    heading: '7. How we protect it and how long we keep it',
    blocks: [
      [
        'Passwords and emailed codes are only kept scrambled (hashed), and codes stop working after 10 minutes.',
        "Your sign-in is kept in your phone's secure storage.",
        'Only people who need to can get to your information, and every admin action is logged.',
        `Login and activity records are kept for ${ACTIVITY_RETENTION_DAYS} days, then deleted by themselves.`,
        'Everything else stays until you delete it or your account.',
      ],
    ],
  },
  {
    heading: '8. Your rights and choices',
    blocks: [
      'Under the Data Privacy Act of 2012 (Republic Act No. 10173), you have the right to see, correct and delete your personal information.',
      [
        'You can delete any conversation at any time.',
        `You can delete your account in Settings. It's erased for good after ${DELETION_GRACE_DAYS} days, together with your emergency contacts, conversations, SOS history and login and activity records. Logging in before then lets you keep it.`,
        'Conversations saved on your phone stay there until you delete them or remove the app.',
        'We may keep our records of admin actions on your account, for security.',
      ],
    ],
  },
];

export const PWD_DECLARATION = {
  title: 'PWD declaration',
  intro:
    'I confirm that I am a person with a disability, or that I am setting up this account for a person with a disability with their knowledge and consent. I understand that:',
  points: [
    'AccessAI uses this only to tailor its features to my needs. It is not verified, and it is not a PWD ID or proof of disability for any other purpose.',
    'AccessAI is built to support me and the people who help me. Giving false information only reduces the help the app can give me.',
    'I am solely responsible for the accuracy of this declaration and for any consequences of giving false information.',
  ],
  confirmation: 'I confirm this declaration is true and I accept responsibility for its accuracy.',
};

/** "2026-09-25" → a local Date, without the UTC shift `new Date('2026-09-25')` would add. */
export function termsLastUpdated(): Date {
  const [year, month, day] = TERMS_VERSION.split('-').map(Number);
  return new Date(year, month - 1, day);
}
