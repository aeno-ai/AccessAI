/**
 * "Where am I?" — what each screen is and what can be done there, for
 * someone who can't see it. Keyed by the route path.
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
  '/learn': { name: 'Learn', tips: 'Tutorials for using AccessAI.' },
  '/settings': { name: 'Settings', tips: 'My needs, display, conversation and speech, quick replies, alerts, SOS and Accel.' },
  '/settings/needs': { name: 'Settings, My needs', tips: 'Choose Blind or low vision, Deaf or hard of hearing, or Mute.' },
  '/settings/display': { name: 'Settings, Display and text', tips: 'Text size, bold text, colors and dark mode.' },
  '/settings/speech': { name: 'Settings, Conversation and speech', tips: 'Reading aloud, voice speed, and a man’s or woman’s voice.' },
  '/settings/quick-replies': { name: 'Settings, Quick replies', tips: 'Add, edit and reorder your quick replies.' },
  '/settings/alerts': { name: 'Settings, Alerts', tips: 'Vibration and screen flash for alerts.' },
  '/settings/sos': { name: 'Settings, Emergency SOS', tips: 'Choose which friends get your SOS, shake to send, and the countdown.' },
  '/settings/accel': { name: 'Settings, Accel', tips: 'Turn me on or off, "Hey Accel", and my voice.' },
  '/accel-guide': { name: 'What Accel can do', tips: 'Every command, with examples you can try.' },
  '/profile': { name: 'Edit profile', tips: 'Your name and the note your friends see.' },
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
