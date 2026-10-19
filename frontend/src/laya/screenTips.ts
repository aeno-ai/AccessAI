/**
 * What each screen is and what can be done there, in English and Filipino —
 * what Laya says for "where am I" when there's nothing live to add
 * (laya/screens.ts). Keyed by the route path. No imports, so the rules
 * check can make sure every Filipino line reads as Filipino.
 */
export type Tips = { name: string; en: string; fil: string };

export const SCREENS: Record<string, Tips> = {
  '/': {
    name: 'Home',
    en: 'From here you can start a conversation, show Big text, use the sign camera, quick replies or Learn, or hold the SOS button.',
    fil: 'Dito ka puwedeng magsimula ng usapan, gumamit ng Big text, ng sign camera, ng quick replies o ng Learn, o pindutin nang matagal ang SOS button.',
  },
  '/conversation': {
    name: 'Conversation mode',
    en: 'Talk face to face. Tap the microphone to speak, or type. Choose Me or Them for who is talking.',
    fil: 'Para ito sa harapang usapan. Pindutin ang mikropono para magsalita, o mag-type. Piliin ang Me o Them kung sino ang nagsasalita.',
  },
  '/chats': { name: 'Chats', en: 'Your saved in-person conversations. Tap one to open it.', fil: 'Ang mga naka-save mong usapan. Pindutin ang isa para buksan ito.' },
  '/friends': {
    name: 'Friends',
    en: 'Your friends. Tap a friend to chat. You can also add a friend from here.',
    fil: 'Ang mga kaibigan mo. Pindutin ang kaibigan para mag-chat. Puwede ka ring mag-add ng kaibigan dito.',
  },
  '/friends/add': {
    name: 'Add a friend',
    en: 'Share your friend code or QR code, or type or scan a friend’s code. Say "what is my friend code" to hear yours.',
    fil: 'Ibahagi ang friend code o QR code mo, o i-type o i-scan ang code ng kaibigan mo. Sabihin ang "ano ang friend code ko" para marinig ito.',
  },
  '/friends/requests': {
    name: 'Friend requests',
    en: 'Accept or decline people who want to be your friend.',
    fil: 'Tanggapin o tanggihan ang mga gustong makipagkaibigan sa iyo.',
  },
  '/learn': {
    name: 'Learn',
    en: 'Short lessons to learn sign language, with camera practice.',
    fil: 'Maiikling lesson para matuto ng sign language, may practice pa sa camera.',
  },
  '/learn-lesson': { name: 'a Learn lesson', en: 'Answer each question, then check it.', fil: 'Sagutin ang bawat tanong, tapos i-check ito.' },
  '/learn-practice': {
    name: 'Practice',
    en: 'Practise any sign you learned in front of the camera.',
    fil: 'I-practice sa harap ng camera ang kahit anong sign na natutunan mo.',
  },
  '/learn-leaderboard': {
    name: 'the Leaderboard',
    en: 'How many lessons you and your friends finished this week.',
    fil: 'Ilang lesson ang natapos mo at ng mga kaibigan mo ngayong linggo.',
  },
  '/learn-credits': {
    name: 'Learn credits',
    en: 'Where the sign videos come from, and how AccessAI learned to read signs.',
    fil: 'Kung saan galing ang mga sign video, at paano natutong magbasa ng sign ang AccessAI.',
  },
  '/sign-camera': {
    name: 'the sign camera',
    en: 'Sign in front of the camera. When you pause, I make it a sentence and say it out loud.',
    fil: 'Mag-sign sa harap ng camera. Pag huminto ka, gagawin ko itong pangungusap at sasabihin nang malakas.',
  },
  '/settings': {
    name: 'Settings',
    en: 'My needs, display, conversation and speech, sign language, quick replies, alerts, SOS and Laya.',
    fil: 'Dito mo babaguhin ang My needs at display, ang conversation at speech, ang sign language at quick replies, ang alerts, ang SOS at si Laya.',
  },
  '/settings/needs': {
    name: 'Settings, My needs',
    en: 'Choose Blind or low vision, Deaf or hard of hearing, or Mute.',
    fil: 'Piliin ang Blind o low vision, Deaf o hard of hearing, o Mute.',
  },
  '/settings/display': {
    name: 'Settings, Display and text',
    en: 'Text size, bold text, colors and dark mode.',
    fil: 'Ang laki ng sulat, bold na sulat, ang mga kulay at dark mode.',
  },
  '/settings/speech': {
    name: 'Settings, Conversation and speech',
    en: 'Reading aloud, voice speed, and a man’s or woman’s voice.',
    fil: 'Pagbasa nang malakas, ang bilis ng boses, at boses ng lalaki o babae.',
  },
  '/settings/quick-replies': {
    name: 'Settings, Quick replies',
    en: 'Add, edit and reorder your quick replies.',
    fil: 'Dito ka magdadagdag, mag-e-edit at mag-aayos ng mga quick reply mo.',
  },
  '/settings/alerts': { name: 'Settings, Alerts', en: 'Vibration and screen flash for alerts.', fil: 'Pag-vibrate at pag-flash ng screen kapag may alert.' },
  '/settings/sos': {
    name: 'Settings, Emergency SOS',
    en: 'Choose which friends get your SOS, shake to send, and the countdown.',
    fil: 'Piliin kung sinong mga kaibigan ang makakatanggap ng SOS mo, ang shake to send, at ang countdown.',
  },
  '/settings/laya': {
    name: 'Settings, Laya',
    en: 'Turn me on or off, "Hey Laya", and my voice.',
    fil: 'Dito mo ako bubuksan o papatayin, ang "Hey Laya", at ang boses ko.',
  },
  '/settings/sign': { name: 'Settings, Sign language', en: 'FSL or ASL, words or letters, and the camera.', fil: 'FSL o ASL, words o letters, at ang camera.' },
  '/laya-guide': { name: 'What Laya can do', en: 'Every command, with examples you can try.', fil: 'Lahat ng utos, may mga halimbawang puwede mong subukan.' },
  '/profile': { name: 'Edit profile', en: 'Your name and the note your friends see.', fil: 'Ang pangalan mo at ang note na nakikita ng mga kaibigan mo.' },
  '/change-email': {
    name: 'Change email',
    en: 'Type your new email, then the code we send to it.',
    fil: 'I-type ang bago mong email, tapos ang code na ipapadala namin dito.',
  },
  '/change-password': { name: 'Change password', en: 'Type your current password, then the new one.', fil: 'I-type ang password mo ngayon, tapos ang bago.' },
  '/emergency-contacts': {
    name: 'Emergency contacts',
    en: 'The phone numbers that get a text with your location when you send an SOS.',
    fil: 'Ang mga numerong makakatanggap ng text na may lokasyon mo kapag nag-SOS ka.',
  },
};
