/**
 * Everything Laya says, in English and in Filipino (HANDOFF.md §34). She
 * answers in the language the command was said in: Tagalog or Taglish gets
 * Filipino, English gets English (laya/language.ts `commandLanguage`).
 *
 * Every Filipino line must sound Filipino to speakMixed, which picks the
 * voice clause by clause from Filipino words (utils/clauses.ts) — the rules
 * check makes sure each one does. Screen names and app words (Settings,
 * Conversation mode, SOS) stay as they're written on screen. No imports
 * except types, so the check scripts can load it in Node.
 */
export type Lang = 'en' | 'fil';
export type Line = { en: string; fil: string };

/** The line in `lang`. */
export const inLang = (lang: Lang, line: Line): string => line[lang];

/** "Ana, Ben and Cara" / "Ana, Ben at Cara" ("or" → "o"). */
export function listOf(lang: Lang, names: string[], joiner: 'and' | 'or' = 'and'): string {
  if (names.length <= 1) return names[0] ?? '';
  const word = lang === 'fil' ? (joiner === 'and' ? 'at' : 'o') : joiner;
  return `${names.slice(0, -1).join(', ')} ${word} ${names[names.length - 1]}`;
}

/** "3 friends" / "1 friend" in English; Filipino nouns don't change. */
const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "si Ana" / "sina Ana at Ben". */
const siSina = (names: string[], lang: Lang) => `${names.length > 1 ? 'sina' : 'si'} ${listOf(lang, names)}`;

export const P = {
  // ---------------------------------------------------------------- the dialog
  yes: { en: 'Yes', fil: 'Oo' },
  no: { en: 'No', fil: 'Hindi' },
  yesQuestion: { en: 'Yes?', fil: "Ano 'yon?" },
  sayYesOrNo: { en: 'Please say yes or no.', fil: 'Sabihin mo lang: oo o hindi.' },
  sayTheName: { en: 'Please say the name.', fil: 'Pakisabi ang pangalan.' },
  sayItAgain: { en: 'Please say it again.', fil: 'Pakiulit mo nga.' },
  cancelled: { en: 'Okay, I cancelled that.', fil: 'Sige, hindi ko na itutuloy.' },
  okay: { en: 'Okay.', fil: 'Sige.' },
  whichOneCancelled: { en: "I didn't catch which one. Okay, I cancelled that.", fil: 'Hindi ko nakuha kung alin. Sige, hindi ko na itutuloy.' },
  heardNothingWake: {
    en: "I didn't hear anything. Say Hey Laya, or tap the Laya button, to try again.",
    fil: 'Wala akong narinig. Sabihin mo ulit ang Hey Laya, o pindutin ang Laya button.',
  },
  heardNothingButton: { en: "I didn't hear anything. Tap the Laya button and try again.", fil: 'Wala akong narinig. Pindutin mo ulit ang Laya button.' },
  needsOfflineEnglish: (steps: string): Line => ({
    en: `I can't hear you without internet yet. To fix it once, download offline English. ${steps}`,
    fil: `Hindi pa kita naririnig kapag walang internet. Para maayos ito, i-download ang offline English. ${steps}`,
  }),
  offlineEnglishSteps: {
    en: 'In the Google app, tap your picture, then Settings, Voice, Offline speech recognition, and download English.',
    fil: 'Sa Google app, pindutin ang litrato mo, tapos ang Settings, ang Voice, ang Offline speech recognition, at i-download ang English.',
  },
  // What the sheet shows.
  listening: { en: 'Listening… say what you want to do.', fil: 'Nakikinig ako… sabihin mo ang gusto mong gawin.' },
  thinking: { en: 'Thinking…', fil: 'Sandali lang…' },
  typeWhatToDo: { en: 'Type what you want me to do.', fil: 'I-type mo ang gusto mong ipagawa.' },
  youSaidQuote: (text: string): Line => ({ en: `You said: “${text}”`, fil: `Sabi mo: “${text}”` }),
  doneTalking: { en: 'Done talking', fil: 'Tapos na ako' },
  orTypeCommand: { en: 'Or type a command', fil: 'O i-type mo ang utos' },
  orTypeAnswer: { en: 'Or type your answer', fil: 'O i-type mo ang sagot mo' },

  // ---------------------------------------------------------------- going places
  takeYouTo: (place: string): Line => ({ en: `You want me to take you to ${place}?`, fil: `Gusto mo bang pumunta sa ${place}?` }),
  opening: (place: string): Line => ({ en: `Opening ${place}.`, fil: `Binubuksan ko na ang ${place}.` }),
  openingConversation: {
    en: 'Opening Conversation mode. The microphone will turn on — start talking after the beep.',
    fil: 'Binubuksan ko na ang Conversation mode. Mag-o-on ang mikropono — magsalita ka pagkatapos ng beep.',
  },
  goBackQuestion: { en: 'Go back to the previous screen?', fil: 'Babalik ba tayo sa naunang screen?' },
  goingBack: { en: 'Going back.', fil: 'Bumabalik na tayo.' },
  openingAddFriend: (code: string): Line => ({
    en: `Opening Add a friend. Your friend code is ${code}. Ask your friend to type it in, or to scan the QR code on this screen.`,
    fil: `Binubuksan ko na ang Add a friend. Ang friend code mo ay ${code}. Ipa-type mo ito sa kaibigan mo, o ipa-scan ang QR code sa screen na ito.`,
  }),
  openingAddFriendNoCode: {
    en: 'Opening Add a friend. Your friend code appears once you are online.',
    fil: 'Binubuksan ko na ang Add a friend. Lalabas ang friend code mo pag online ka na.',
  },
  elsewhere: (where: string, how: string): Line => ({
    en: `That works in ${where}. To go there, say: ${how}.`,
    fil: `Gumagana iyan sa ${where}. Para pumunta doon, sabihin: ${how}.`,
  }),
  howToReachConversation: { en: 'start a conversation', fil: 'magsimula ng usapan' },
  howToReachChats: { en: 'open my chats', fil: 'buksan ang mga chat ko' },
  howToReachLesson: { en: 'start the next lesson', fil: 'simulan ang susunod na lesson' },
  callLaya: { en: 'Hey Laya, ', fil: 'Uy Laya, ' },
  youAreOn: (name: string, live: string): Line => ({ en: `You're on ${name}. ${live}`, fil: `Ito ang ${name}. ${live}` }),

  // ---------------------------------------------------------------- friends and messages
  notAFriend: (name: string): Line => ({ en: `I couldn't find ${name} among your friends.`, fil: `Hindi ko nakita si ${name} sa mga kaibigan mo.` }),
  whichOfThem: (names: string): Line => ({ en: `Which one: ${names}?`, fil: `Alin sa kanila ang ibig mong sabihin: ${names}?` }),
  whichFriend: { en: 'Which friend?', fil: 'Sinong kaibigan?' },
  whichFriendChat: {
    en: 'Which friend? For example, say "open my chat with Ana".',
    fil: 'Sinong kaibigan? Halimbawa, sabihin: "buksan ang chat namin ni Ana".',
  },
  whatToTell: (name: string): Line => ({ en: `What do you want to tell ${name}?`, fil: `Ano ang gusto mong sabihin kay ${name}?` }),
  sendTo: (name: string, text: string): Line => ({ en: `Send to ${name}: "${text}"?`, fil: `Ipapadala ko ba kay ${name}: "${text}"?` }),
  sentTo: (name: string): Line => ({ en: `Sent to ${name}.`, fil: `Naipadala na kay ${name}.` }),
  savedForLater: (name: string): Line => ({
    en: `Saved. It will send to ${name} when you're back online.`,
    fil: `Naka-save na. Ipapadala ko ito kay ${name} pag online ka na ulit.`,
  }),
  wontSend: { en: "Okay, I won't send it.", fil: 'Sige, hindi ko na ipapadala.' },
  noOlderMessages: { en: 'There are no older messages.', fil: 'Wala nang mas lumang message.' },
  notMessagedYet: (name: string): Line => ({ en: `You and ${name} haven't messaged yet.`, fil: `Hindi pa kayo nagme-message ni ${name}.` }),
  hearOlder: { en: 'Hear older messages?', fil: 'Gusto mo bang marinig ang mga mas lumang message?' },
  allNewMessagesRead: (extra: string): Line => ({ en: `That's all your new messages.${extra}`, fil: `Iyan na ang lahat ng bagong message mo.${extra}` }),
  alsoRequests: (n: number): Line => ({
    en: ` You also have ${count(n, 'friend request')}.`,
    fil: ` May ${n} friend request ka rin.`,
  }),
  newMessagesFrom: (names: string): Line => ({ en: `New messages from ${names}. `, fil: `May bagong message mula kay ${names}. ` }),
  friendMessagedYou: (name: string): Line => ({ en: `${name} sent you a message.`, fil: `Nag-message sa iyo si ${name}.` }),
  replyTo: (name: string): Line => ({ en: `Reply to ${name}?`, fil: `Sasagutin mo ba si ${name}?` }),
  chatIntro: (name: string): Line => ({ en: `Your chat with ${name}. `, fil: `Ang chat ninyo ni ${name}. ` }),
  chatHowToGoOn: (call: string): Line => ({
    en: ` To answer, say: ${call}reply. To hear more, say: ${call}older messages.`,
    fil: ` Para sumagot, sabihin: ${call}sagutin. Para makarinig pa, sabihin: ${call}mga naunang message.`,
  }),
  openChatQuestion: (name: string): Line => ({ en: `Open your chat with ${name}?`, fil: `Bubuksan ko ba ang chat ninyo ni ${name}?` }),
  noNewMessages: (extra: string): Line => ({ en: `No new messages.${extra}`, fil: `Walang bagong message.${extra}` }),
  whoseChat: {
    en: 'Whose chat? For example, say "read my chat with Ana".',
    fil: 'Kaninong chat ang babasahin ko? Halimbawa, sabihin: "basahin ang usapan namin ni Ana".',
  },
  openAChatFirst: {
    en: 'Open a chat first, or say "read my chat with Ana".',
    fil: 'Magbukas ka muna ng chat, o sabihin: "basahin ang usapan namin ni Ana".',
  },
  toWhom: {
    en: 'To whom? For example, say "read my last message to Ana".',
    fil: 'Para kanino? Halimbawa, sabihin: "ano ang huling sinabi ko kay Ana".',
  },
  notSentYet: (name: string): Line => ({ en: `You haven't sent ${name} a message yet.`, fil: `Hindi ka pa nagpapadala ng message kay ${name}.` }),
  youSaidTo: (name: string, when: string, body: string): Line => ({
    en: `You said to ${name}, ${when}: ${body}`,
    fil: `Sinabi mo kay ${name}, ${when}: ${body}`,
  }),
  waitingToSend: { en: " It's waiting to send.", fil: ' Naghihintay pa itong maipadala.' },
  whoseMessage: {
    en: 'Whose message? For example, say "read Ana\'s last message".',
    fil: 'Kaninong message ang babasahin ko? Halimbawa, sabihin: "ano sabi ni Ana".',
  },
  noMessagesFrom: (name: string): Line => ({ en: `There are no messages from ${name} yet.`, fil: `Wala pang message mula kay ${name}.` }),
  friendSentSos: (name: string, when: string, body: string): Line => ({ en: `${name} sent an SOS ${when}: ${body}`, fil: `Nag-SOS si ${name} ${when}: ${body}` }),
  friendSaid: (name: string, when: string, body: string): Line => ({ en: `${name} said, ${when}: ${body}`, fil: `Sabi ni ${name}, ${when}: ${body}` }),
  /** One message read aloud: "Andrew said: …", "You said: …". */
  messageLine: (who: 'me' | string, body: string, sos: boolean): Line =>
    who === 'me'
      ? sos
        ? { en: `You sent an SOS: ${body}`, fil: `Nag-SOS ka: ${body}` }
        : { en: `You said: ${body}`, fil: `Sabi mo: ${body}` }
      : sos
        ? { en: `${who} sent an SOS: ${body}`, fil: `Nag-SOS si ${who}: ${body}` }
        : { en: `${who} said: ${body}`, fil: `Sabi ni ${who}: ${body}` },
  justNow: { en: 'just now', fil: 'ngayon lang' },
  minutesAgo: (n: number): Line => ({ en: `${count(n, 'minute')} ago`, fil: `${n} minuto na ang nakalipas` }),
  hoursAgo: (n: number): Line => ({ en: `${count(n, 'hour')} ago`, fil: `${n} oras na ang nakalipas` }),
  earlier: { en: 'earlier', fil: 'kanina' },
  cantTellOnline: { en: "I can't tell who's online while you're offline.", fil: 'Hindi ko malalaman kung sino ang online habang offline ka.' },
  areOnline: (names: string[], lang: Lang): Line => ({
    en: `${listOf('en', names)} ${names.length === 1 ? 'is' : 'are'} online.`,
    fil: `Online ngayon ${siSina(names, lang)}.`,
  }),
  noneOnline: { en: 'None of your friends are online right now.', fil: 'Walang online sa mga kaibigan mo ngayon.' },
  yourFriendCode: (code: string): Line => ({ en: `Your friend code is ${code}. Again: ${code}.`, fil: `Ang friend code mo ay ${code}. Uulitin ko: ${code}.` }),
  friendCodeOnceOnline: { en: 'Your friend code appears once you are online.', fil: 'Lalabas ang friend code mo pag online ka na.' },
  noFriendRequests: { en: 'You have no friend requests.', fil: 'Wala kang friend request.' },
  wantToBeFriends: (names: string[], first: string, lang: Lang): Line => ({
    en: `${listOf('en', names)} ${names.length === 1 ? 'wants' : 'want'} to be your friend. Say "accept ${first}'s request" to accept.`,
    fil: `Gustong makipagkaibigan sa iyo ${siSina(names, lang)}. Para tanggapin, sabihin: "tanggapin ang request ni ${first}".`,
  }),
  whoToSendTo: { en: 'Who should I send it to?', fil: 'Kanino ko ito ipapadala?' },
  nobodyMessaged: { en: 'Nobody has messaged you yet.', fil: 'Wala pang nag-message sa iyo.' },
  whoToMessage: { en: 'Who do you want to message?', fil: 'Sino ang gusto mong i-message?' },
  nameNotCaught: { en: "I didn't catch the name. Okay, I cancelled that.", fil: 'Hindi ko nakuha ang pangalan. Sige, hindi ko na itutuloy.' },
  sayTheCode: {
    en: 'Say the friend code letter by letter, for example "add friend code A B C D 2 3 4 5".',
    fil: 'Sabihin ang friend code nang isa-isang letra, halimbawa: "i-add ang friend code A B C D 2 3 4 5".',
  },
  sendRequestTo: (code: string): Line => ({ en: `Send a friend request to code ${code}?`, fil: `Magpapadala ba ako ng friend request sa code ${code}?` }),
  nowFriends: (name: string): Line => ({ en: `You and ${name} are now friends.`, fil: `Magkaibigan na kayo ni ${name}.` }),
  requestSent: (name: string): Line => ({
    en: `Friend request sent to ${name}. They need to accept it.`,
    fil: `Naipadala na ang friend request kay ${name}. Kailangan niya itong tanggapin.`,
  }),
  someone: { en: 'them', fil: 'siya' },
  acceptQuestion: (name: string): Line => ({ en: `Accept ${name}'s friend request?`, fil: `Tatanggapin ko ba ang friend request ni ${name}?` }),
  declineQuestion: (name: string): Line => ({ en: `Decline ${name}'s friend request?`, fil: `Tatanggihan ko ba ang friend request ni ${name}?` }),
  declined: { en: 'Declined.', fil: 'Tinanggihan ko na.' },
  requestsFrom: (names: string, first: string): Line => ({
    en: `You have requests from ${names}. Say whose, for example "accept ${first}'s request".`,
    fil: `May request ka mula kina ${names}. Sabihin kung kanino, halimbawa: "tanggapin ang request ni ${first}".`,
  }),
  whoseRequest: { en: 'Whose request?', fil: 'Kaninong request ang ibig mong sabihin?' },

  // ---------------------------------------------------------------- emergency
  sosOnlyPwd: { en: 'Sending an SOS is only for PWD accounts.', fil: 'Ang pagpapadala ng SOS ay para lang sa mga PWD account.' },
  noSosGoing: { en: "You don't have an SOS going right now.", fil: 'Wala kang SOS na tumatakbo ngayon.' },
  cancelUnsentSos: {
    en: "Your SOS hasn't gone out yet, because there's no internet. Cancel it?",
    fil: 'Hindi pa naipapadala ang SOS mo dahil walang internet. Kakanselahin ko ba ito?',
  },
  sosWontSend: { en: "Okay. Your SOS won't be sent.", fil: 'Sige. Hindi na ipapadala ang SOS mo.' },
  endSosQuestion: {
    en: "End your SOS and tell your friends you're safe?",
    fil: 'Tatapusin ko ba ang SOS mo at sasabihin sa mga kaibigan mo na ligtas ka na?',
  },
  sosEnded: { en: "Done. Your friends were told you're safe.", fil: 'Tapos na. Nasabihan ko na ang mga kaibigan mo na ligtas ka.' },
  circleAddQuestion: (name: string): Line => ({
    en: `Add ${name} to your SOS circle? They'll get your SOS alerts.`,
    fil: `Isasama ko ba si ${name} sa SOS circle mo? Makakatanggap siya ng mga SOS alert mo.`,
  }),
  circleRemoveQuestion: (name: string): Line => ({
    en: `Remove ${name} from your SOS circle? They won't get your SOS alerts any more.`,
    fil: `Tatanggalin ko ba si ${name} sa SOS circle mo? Hindi na siya makakatanggap ng mga SOS alert mo.`,
  }),
  circleAdded: (name: string): Line => ({ en: `${name} will now get your SOS alerts.`, fil: `Makakatanggap na si ${name} ng mga SOS alert mo.` }),
  circleRemoved: (name: string): Line => ({ en: `${name} won't get your SOS alerts.`, fil: `Hindi na makakatanggap si ${name} ng mga SOS alert mo.` }),
  cantCheckRecentSos: {
    en: "I can't check recent SOS right now. Try again when you're online.",
    fil: 'Hindi ko ma-check ang mga recent SOS ngayon. Subukan mo ulit pag online ka na.',
  },
  stillGoing: { en: ' It is still going.', fil: ' Tuloy pa ito.' },
  yourLastSos: (when: string, active: boolean): Line => ({
    en: `Your last SOS was ${when}${active ? ', and it is still going' : ''}.`,
    fil: `Ang huling SOS mo ay ${when}${active ? ', at tuloy pa ito' : ''}.`,
  }),
  noSosThisWeek: { en: 'No SOS in the past week.', fil: 'Walang SOS nitong nakaraang linggo.' },
  savedFrom: (when: string): Line => ({ en: ` This is from ${when}; you're offline.`, fil: ` Galing ito noong ${when}; offline ka.` }),

  // ---------------------------------------------------------------- help
  helpHere: (name: string, examples: string): Line => ({ en: `On ${name}, you can say: ${examples}. `, fil: `Sa ${name}, puwede mong sabihin: ${examples}. ` }),
  helpEverywhere: {
    en: 'Anywhere, you can say: go home. Any new messages? What\'s on this screen? Or, in an emergency: SOS. Say "show me what you can do" for the full list.',
    fil: 'Kahit saan, puwede mong sabihin: punta sa home. May bagong message ba? Ano\'ng nandito? O kapag may emergency: SOS. Sabihin ang "ipakita ang lahat ng kaya mo" para sa buong listahan.',
  },
  onlyInsideAccessAI: { en: 'I can only help inside AccessAI.', fil: 'Sa loob lang ng AccessAI ako makakatulong.' },
  cantAnswerQuestions: {
    en: 'I can only help with things in AccessAI, so I can’t answer questions like that. Say "what can I say" to hear what I can do.',
    fil: 'Sa loob lang ng AccessAI ako makakatulong, kaya hindi ko masasagot ang ganyang tanong. Sabihin ang "ano ang pwede kong sabihin" para marinig mo ang kaya ko.',
  },
  nothingSaidYet: { en: "I haven't said anything yet.", fil: 'Wala pa akong sinasabi.' },
  blockedAccount: {
    en: 'For your safety, I can’t do that by voice. You can do it yourself in the menu, or in Edit profile.',
    fil: 'Para sa kaligtasan mo, hindi ko iyan magagawa gamit ang boses. Ikaw mismo ang gumawa nito sa menu, o sa Edit profile.',
  },
  didntCatch: {
    en: 'Sorry, I didn’t catch that. Say "what can I say" to hear what I can do.',
    fil: 'Pasensya na, hindi ko nakuha. Sabihin ang "ano ang pwede kong sabihin" para marinig mo ang kaya ko.',
  },
  errorTryAgain: { en: "That didn't work. Please try again.", fil: 'Hindi gumana. Pakisubukan mo ulit.' },

  // ---------------------------------------------------------------- conversations
  noConversationsYet: (call: string): Line => ({
    en: `You don't have any saved conversations yet. Say: ${call}start a conversation.`,
    fil: `Wala ka pang naka-save na usapan. Sabihin: ${call}magsimula ng usapan.`,
  }),
  openLastConversation: (title: string): Line => ({ en: `Open your last conversation, ${title}?`, fil: `Bubuksan ko ba ang huling usapan mo, ${title}?` }),
  startNamedQuestion: (name: string): Line => ({
    en: `Start a new conversation called ${name}?`,
    fil: `Magsisimula ba ako ng bagong usapan na ${name} ang pangalan?`,
  }),
  startUnnamedQuestion: { en: 'Start a new conversation?', fil: 'Magsisimula ba ako ng bagong usapan?' },
  startingNamed: (name: string): Line => ({ en: `Starting a conversation called ${name}.`, fil: `Nagsisimula na ang usapan na ${name}.` }),

  // ---------------------------------------------------------------- Big text and the sign camera
  bigTextOpening: { en: 'Opening Big text. Type what you want to show.', fil: 'Binubuksan ko na ang Big text. I-type mo ang gusto mong ipakita.' },
  bigTextShowing: (text: string): Line => ({ en: `Showing it big: ${text}`, fil: `Ipinapakita ko na nang malaki: ${text}` }),
  signCameraOpening: {
    en: "Opening the sign camera. Sign in front of it, and I'll say it out loud.",
    fil: 'Binubuksan ko na ang sign camera. Mag-sign ka sa harap nito, at sasabihin ko ito nang malakas.',
  },

  // ---------------------------------------------------------------- Learn
  pickSignLanguageFirst: {
    en: "You haven't picked a sign language yet. Open Learn to choose one?",
    fil: 'Wala ka pang napiling sign language. Bubuksan ko ba ang Learn para pumili ka?',
  },
  finishedEveryLevel: { en: "You've finished every level that's open. Well done!", fil: 'Tapos mo na ang lahat ng bukas na level. Ang galing mo!' },
  reviewTeaches: { en: 'It goes over every sign of the unit.', fil: 'Uulitin nito ang lahat ng sign sa unit.' },
  lessonTeaches: (signs: string): Line => ({ en: `It teaches ${signs}.`, fil: `Ituturo nito ang ${signs}.` }),
  startLessonQuestion: (title: string, unit: string, teaches: string): Line => ({
    en: `Start ${title} of ${unit}? ${teaches}`,
    fil: `Sisimulan ba natin ang ${title} ng ${unit}? ${teaches}`,
  }),
  startingLesson: (title: string): Line => ({ en: `Starting ${title}.`, fil: `Sinisimulan na natin ang ${title}.` }),

  // ---------------------------------------------------------------- voice and text
  alreadySlowest: { en: "That's already my slowest.", fil: 'Pinakamabagal na ako.' },
  alreadyFastest: { en: "That's already my fastest.", fil: 'Pinakamabilis na ako.' },
  slowerQuestion: { en: 'Make my voice slower?', fil: 'Babagalan ko ba ang boses ko?' },
  fasterQuestion: { en: 'Make my voice faster?', fil: 'Bibilisan ko ba ang boses ko?' },
  slowerDone: { en: 'Okay. I will speak slower.', fil: 'Sige. Babagalan ko ang pagsasalita ko.' },
  fasterDone: { en: 'Okay. I will speak faster.', fil: 'Sige. Bibilisan ko ang pagsasalita ko.' },
  alreadyBiggest: { en: 'The text is already at its biggest.', fil: 'Pinakamalaki na ang sulat.' },
  alreadySmallest: { en: 'The text is already at its smallest.', fil: 'Pinakamaliit na ang sulat.' },
  biggerQuestion: { en: 'Make the text bigger?', fil: 'Palalakihin ko ba ang sulat?' },
  smallerQuestion: { en: 'Make the text smaller?', fil: 'Paliliitin ko ba ang sulat?' },
  biggerDone: { en: 'The text is bigger now.', fil: 'Mas malaki na ang sulat.' },
  smallerDone: { en: 'The text is smaller now.', fil: 'Mas maliit na ang sulat.' },
  voiceHowTo: {
    en: 'Say "use a man\'s voice", "use a woman\'s voice", or "use the normal voice".',
    fil: 'Sabihin: "boses ng lalaki", "boses ng babae", o "normal na boses".',
  },
  voiceMan: { en: "a man's voice", fil: 'boses ng lalaki' },
  voiceWoman: { en: "a woman's voice", fil: 'boses ng babae' },
  voiceNormal: { en: "the phone's normal voice", fil: 'normal na boses ng phone' },
  voiceQuestion: (name: string): Line => ({ en: `Read things aloud in ${name}?`, fil: `Gagamitin ko ba ang ${name} sa pagbasa nang malakas?` }),
  voiceDone: (name: string): Line => ({
    en: `Okay. Messages will be read in ${name}. My own voice is set in Laya settings.`,
    fil: `Sige. Babasahin ang mga message gamit ang ${name}. Ang sarili kong boses ay nasa Laya settings.`,
  }),

  // ---------------------------------------------------------------- Conversation mode (its own commands)
  yourTurn: { en: 'Your turn. Start talking after the beep.', fil: 'Ikaw na. Magsalita ka pagkatapos ng beep.' },
  theirTurn: { en: "Their turn. I'm listening to them.", fil: 'Siya na. Nakikinig na ako sa kanya.' },
  sayQuestion: (text: string): Line => ({ en: `Say "${text}"?`, fil: `Sasabihin ko ba: "${text}"?` }),
  convLine: (mine: boolean, body: string): Line => (mine ? { en: `You said: ${body}`, fil: `Sabi mo: ${body}` } : { en: `They said: ${body}`, fil: `Sabi niya: ${body}` }),
  convNaming: {
    en: 'A new conversation. It asks for a name: type one, or say "my turn" to start without one.',
    fil: 'Bagong usapan ito. Hinihingi nito ang pangalan: mag-type ng isa, o sabihin ang "ako na" para magsimula nang walang pangalan.',
  },
  convEmpty: (title: string): Line => ({
    en: `${title}No messages yet. Say "my turn" to talk, or "their turn" to listen to the other person.`,
    fil: `${title}Wala pang message. Sabihin ang "ako na" para magsalita, o "siya na" para pakinggan ang kausap mo.`,
  }),
  convState: (title: string, n: number, lastMine: boolean, when: string, myTurn: boolean): Line => ({
    en: `${title}${count(n, 'message')}. ${lastMine ? 'You' : 'They'} spoke last, ${when}. It's ${myTurn ? 'your' : 'their'} turn.`,
    fil: `${title}May ${n} na message. ${lastMine ? 'Ikaw' : 'Siya'} ang huling nagsalita, ${when}. ${myTurn ? 'Ikaw' : 'Siya'} na ang magsasalita.`,
  }),
  newConversationNamed: (name: string): Line => ({
    en: `New conversation, ${name}. Say "my turn" to talk.`,
    fil: `Bagong usapan ito, ${name}. Sabihin ang "ako na" para magsalita.`,
  }),
  newConversationUnnamed: {
    en: 'New conversation. To name it, say "rename it to", then the name.',
    fil: 'Bagong usapan ito. Para pangalanan ito, sabihin ang "palitan ang pangalan ng", tapos ang pangalan.',
  },
  whatShouldISay: { en: 'What should I say?', fil: 'Ano ang sasabihin ko?' },
  theySaid: (when: string, body: string): Line => ({ en: `They said, ${when}: ${body}`, fil: `Sabi niya, ${when}: ${body}` }),
  theyHaventSpoken: { en: "They haven't said anything yet.", fil: 'Wala pa siyang sinasabi.' },
  noMessagesYet: { en: 'No messages yet.', fil: 'Wala pang message.' },
  lastFiveOf: (n: number): Line => ({ en: ` Those were the last 5 of ${n} messages.`, fil: ` Iyan ang huling 5 sa ${n} na message.` }),
  noQuickReplies: {
    en: 'You have no quick replies. Add them in Settings, Quick replies.',
    fil: 'Wala kang quick reply. Magdagdag ka sa Settings, sa Quick replies.',
  },
  yourQuickReplies: (list: string): Line => ({
    en: `Your quick replies. ${list}. To say one, say "quick reply" and its number.`,
    fil: `Ang mga quick reply mo. ${list}. Para sabihin ang isa, sabihin ang "quick reply" at ang numero nito.`,
  }),
  whichQuickReply: (n: number): Line => ({
    en: `Which one? You have ${count(n, 'quick reply', 'quick replies')}. Say "quick replies" to hear them.`,
    fil: `Alin dito? May ${n} kang quick reply. Sabihin ang "mga quick reply" para marinig mo ang mga ito.`,
  }),
  signModeOn: { en: 'Sign language mode is on. The other person can sign to the camera.', fil: 'Naka-on na ang sign language mode. Puwede nang mag-sign ang kausap mo sa camera.' },
  signModeOff: { en: 'Sign language mode is off.', fil: 'Naka-off na ang sign language mode.' },
  renameQuestion: (name: string): Line => ({ en: `Rename this conversation to ${name}?`, fil: `Papalitan ko ba ang pangalan ng usapang ito ng ${name}?` }),
  renamed: (name: string): Line => ({ en: `Renamed to ${name}.`, fil: `Napalitan na ang pangalan: ${name}.` }),
  whatToCallIt: { en: 'What should I call it?', fil: 'Ano ang ipapangalan ko dito?' },
  endConversationQuestion: { en: "End this conversation? It's already saved in Chats.", fil: 'Tatapusin ko na ba ang usapang ito? Naka-save na ito sa Chats.' },
  leaveConversationQuestion: { en: 'Leave Conversation mode?', fil: 'Aalis na ba tayo sa Conversation mode?' },
  savedGoingBack: { en: 'Saved. Going back.', fil: 'Naka-save na. Bumabalik na tayo.' },

  // ---------------------------------------------------------------- Chats (its own commands)
  chatsLoading: { en: 'Your conversations are loading.', fil: 'Nilo-load pa ang mga usapan mo.' },
  chatsNone: {
    en: 'You have no saved conversations yet. Say "start a conversation" to begin one.',
    fil: 'Wala ka pang naka-save na usapan. Sabihin ang "magsimula ng usapan" para magsimula.',
  },
  chatsList: (n: number, newest: string): Line => ({
    en: `${count(n, 'saved conversation')}. The newest: ${newest}.`,
    fil: `May ${n} na naka-save na usapan. Ang mga pinakabago: ${newest}.`,
  }),
  noConversationCalled: (name: string): Line => ({ en: `I couldn't find a conversation called ${name}.`, fil: `Wala akong nakitang usapan na ${name} ang pangalan.` }),
  that: { en: 'that', fil: 'iyan' },
  openQuestion: (title: string): Line => ({ en: `Open ${title}?`, fil: `Bubuksan ko ba ang ${title}?` }),
  noSavedConversations: { en: 'You have no saved conversations yet.', fil: 'Wala ka pang naka-save na usapan.' },
  noMessages: { en: 'No messages.', fil: 'Walang message.' },

  // ---------------------------------------------------------------- a Learn lesson (its own commands)
  lessonDone: { en: 'The lesson is done. Say "continue" to go back to Learn.', fil: 'Tapos na ang lesson. Sabihin ang "tuloy" para bumalik sa Learn.' },
  lessonGettingReady: { en: 'The lesson is getting ready.', fil: 'Inihahanda pa ang lesson.' },
  newSign: (sign: string, steps: string): Line => ({
    en: `New sign: ${sign}. ${steps} Say "continue" when you're ready.`,
    fil: `Bagong sign: ${sign}. ${steps} Sabihin ang "tuloy" kapag handa ka na.`,
  }),
  whichVideoSigns: (sign: string): Line => ({ en: `Which video signs ${sign}?`, fil: `Aling video ang nagsa-sign ng ${sign}?` }),
  whatSignSteps: (steps: string): Line => ({ en: `What sign do these steps make? ${steps}`, fil: `Anong sign ang ginagawa ng mga hakbang na ito? ${steps}` }),
  whatDoesSignMean: { en: 'What does this sign mean?', fil: 'Ano ang ibig sabihin ng sign na ito?' },
  gotItRight: { en: 'You got it right.', fil: 'Tama ang sagot mo.' },
  answerWas: (answer: string): Line => ({ en: `The answer was ${answer}.`, fil: `Ang tamang sagot ay ${answer}.` }),
  sayContinue: { en: 'Say "continue".', fil: 'Sabihin ang "tuloy".' },
  youChose: (choice: string): Line => ({ en: `You chose ${choice}. Say "check".`, fil: `Ang pinili mo ay ${choice}. Sabihin ang "i-check".` }),
  sayFirstOne: { en: 'Say "the first one", or the answer.', fil: 'Sabihin ang "yung una", o ang sagot.' },
  theChoices: (choices: string): Line => ({ en: `The choices: ${choices}.`, fil: `Ang mga pagpipilian: ${choices}.` }),
  yourTurnToSign: (sign: string): Line => ({
    en: `Your turn: sign ${sign} in front of the camera. Say "hear the steps" for how, or "skip".`,
    fil: `Ikaw na: i-sign ang ${sign} sa harap ng camera. Sabihin ang "paano gawin" para malaman kung paano, o "laktawan".`,
  }),
  matchVideos: { en: 'Match each video to its word.', fil: 'Itugma ang bawat video sa salita nito.' },
  videoNumber: (n: number): Line => ({ en: `video ${n}`, fil: `video ${n}` }),
  sayOneOfChoices: (choices: string): Line => ({ en: `Say one of the choices: ${choices}.`, fil: `Sabihin ang isa sa mga pagpipilian: ${choices}.` }),
  noChoicesHere: { en: 'there are none here', fil: 'wala dito' },
  questionDone: { en: 'That question is done. Say "continue".', fil: 'Tapos na ang tanong na iyan. Sabihin ang "tuloy".' },
  chosenSayCheck: (choice: string): Line => ({ en: `${choice}. Say "check" to check it.`, fil: `${choice}. Sabihin ang "i-check" para tingnan kung tama.` }),
  nothingToCheck: { en: 'There is nothing to check here. Say "continue".', fil: 'Walang iche-check dito. Sabihin ang "tuloy".' },
  alreadyChecked: { en: 'Already checked. Say "continue".', fil: 'Na-check na ito. Sabihin ang "tuloy".' },
  chooseFirst: (choices: string): Line => ({ en: `Choose an answer first. The choices: ${choices}.`, fil: `Pumili ka muna ng sagot. Ang mga pagpipilian: ${choices}.` }),
  checkResult: (right: boolean, answer: string): Line =>
    right
      ? { en: 'That\'s right! Say "continue".', fil: 'Tama! Sabihin ang "tuloy".' }
      : { en: `Not quite. The answer is ${answer}. Say "continue".`, fil: `Hindi tama. Ang sagot ay ${answer}. Sabihin ang "tuloy".` },
  sayCheckFirst: { en: 'Say "check" first.', fil: 'Sabihin mo muna ang "i-check".' },
  noStepsHere: { en: 'This question has no steps to hear.', fil: 'Walang hakbang na maririnig sa tanong na ito.' },
  stepsWhichOne: (steps: string, choices: string): Line => ({ en: `${steps} Is it ${choices}?`, fil: `${steps} Alin dito ang tama: ${choices}?` }),
  skipped: { en: 'Skipped.', fil: 'Nilaktawan ko na.' },
  cantSkip: {
    en: 'This one can’t be skipped. Answer it, or say "go back" to leave the lesson.',
    fil: 'Hindi puwedeng laktawan ito. Sagutin mo, o sabihin ang "bumalik" para umalis sa lesson.',
  },
} satisfies Record<string, Line | ((...args: never[]) => Line)>;
