// Everything the user agrees to at sign-up lives here, so the wording can be
// edited in one place. Whenever it changes, bump TERMS_VERSION here AND in
// backend/src/constants/legal.js — the backend stamps each account with the
// version it agreed to.
export const TERMS_VERSION = '2026-10-07';

// Must match DELETION_GRACE_DAYS in backend/src/constants/legal.js.
export const DELETION_GRACE_DAYS = 15;

/**
 * A section of the terms. Each block is either a paragraph (a string) or a
 * bulleted list (an array of strings).
 */
export type TermsSection = {
  heading: string;
  blocks: (string | string[])[];
};

export const TERMS_INTRO =
  'Please read this before creating your account. By ticking the box on the sign-up screen, you agree to these terms and to AccessAI handling your information as described below.';

export const TERMS_SECTIONS: TermsSection[] = [
  {
    heading: '1. About AccessAI',
    blocks: [
      'AccessAI is a communication and accessibility assistant for persons with disabilities (PWDs) and the family and friends who support them.',
    ],
  },
  {
    heading: '2. Your account',
    blocks: [
      [
        'Give accurate information when you sign up, including whether you are registering as a PWD.',
        'Keep your password, your email account and (if you use it to sign in) your Google account private. You are responsible for activity on your account.',
        'If you are under 18, a parent or guardian must agree to these terms on your behalf.',
      ],
    ],
  },
  {
    heading: '3. What we collect',
    blocks: [
      [
        'Account details: your name, email address and account type (PWD or non-PWD). Whether you are a PWD is sensitive personal information under the Data Privacy Act.',
        'Your password, if you set one, stored only in a scrambled (hashed) form that cannot be turned back into the original.',
        'If you continue with Google: your name and email address from your Google account, and the ID Google gives it. We never see your Google password.',
        'Emergency contacts you add: their name, phone number, relationship and, optionally, email address. Only add people who have agreed to be your emergency contact.',
        'Your conversations: their titles and messages. They are saved on your device and backed up to our server when you are online.',
        'Friends and online chats: your friend code, who you are friends with, the messages you send them, whether you are online, and an optional note you choose to show your friends. Your note can describe a disability only if you decide to write that.',
        'SOS alerts: when you send one, the time, the message, the place name your phone looks up and, only if you allow location access, your location — which keeps updating for up to 30 minutes while AccessAI is open, or until you say you are safe. Only the newest position is kept. We also keep which friends answered ("seen" or "on my way").',
        'Notification address: if you allow notifications, the address (push token) that lets us send your phone SOS alerts and messages while AccessAI is closed.',
        'Your accessibility settings (such as text size, colors and your chosen needs), which stay on your device.',
      ],
    ],
  },
  {
    heading: '4. How we use it',
    blocks: [
      'We use your information only to:',
      [
        'create and manage your account, confirm your email address and sign you in;',
        "tailor AccessAI's features to your account type;",
        'back up your conversations;',
        'deliver your messages to your friends and show them when you are online;',
        'alert the friends in your SOS circle when you send an SOS, and help you text your emergency contacts;',
        'keep the service secure, for example by blocking repeated failed sign-in attempts.',
      ],
      "We do not sell your information or use it for advertising. We do not share it with anyone except the services that help us run AccessAI: the cloud database provider that stores it, the email service that delivers your sign-in codes, and Expo, Google and Apple, who deliver notifications to your phone. If you continue with Google, Google knows you signed in to AccessAI. Text-to-speech runs on your device.",
      "When you use the microphone, speech is turned into text on your phone itself whenever your phone supports it. Otherwise, what is said is sent to your phone's speech service (Apple's or Google's) to be turned into text. AccessAI never records or keeps the audio; only the text you choose to send is saved.",
      'Accel, the voice assistant: "Hey Accel" listens only on your phone, only while AccessAI is open. When "Smarter understanding" is on and you are online, the words of a command (not the audio) are sent to the AccessAI server, where our own AI works out what you asked for. The same AI can tidy a message before you send it. Nothing you say to Accel is stored.',
      'Sign language: while sign mode is on, short video clips from the camera are sent to the AccessAI server to recognize the signs. Each clip is read and then deleted straight away — no video is kept.',
    ],
  },
  {
    heading: '5. Who can see it',
    blocks: [
      'You can see all of your own information. Your friends can see your name, your note for friends, whether you are online, and the messages you send them — never your email address or account type. Friends you put in your SOS circle receive your SOS message and location when you send an SOS. People can only add you as a friend with your friend code.',
      'Authorized AccessAI administrators can see your name, email address, account type and account status so they can manage accounts. They cannot see your password, and the admin panel does not show your conversations, chats or emergency contacts.',
    ],
  },
  {
    heading: '6. How we protect it',
    blocks: [
      [
        'Passwords and emailed codes are stored only in hashed form, and codes stop working after 10 minutes.',
        "Your sign-in is kept in your device's secure storage.",
        'Access to your information is restricted, and administrator actions are logged.',
      ],
    ],
  },
  {
    heading: '7. Your rights and choices',
    blocks: [
      'Under the Data Privacy Act of 2012 (Republic Act No. 10173), you have the right to access, correct and delete your personal information.',
      [
        'You can delete any conversation at any time.',
        `You can delete your account in Settings. It is permanently erased after ${DELETION_GRACE_DAYS} days, together with your emergency contacts, conversations and SOS history. Logging in before then lets you cancel the deletion.`,
        'Conversations saved on your phone stay there until you delete them or uninstall the app.',
        'Records of administrator actions on your account may be kept for security.',
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
