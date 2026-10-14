// Checks what switching "My needs" does (src/constants/profiles.ts):
//   npx tsx scripts/profiles-check.ts
// Every profile says whether Accel is on, and only the profile's own quick
// reply swaps — the user's own replies stay.
/// <reference types="node" />
import {
  MAX_QUICK_REPLIES,
  PROFILE_IDS,
  PROFILE_PRESETS,
  quickRepliesAfterSwitch,
  suggestedQuickReplies,
} from '../src/constants/profiles';

let passed = 0;
let failed = 0;
function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${name}${detail !== undefined ? ` — got ${JSON.stringify(detail)}` : ''}`);
  }
}

console.log('Accel');
check(
  'every profile says whether Accel and "Hey Accel" are on',
  PROFILE_IDS.every((id) => typeof PROFILE_PRESETS[id].accelEnabled === 'boolean' && typeof PROFILE_PRESETS[id].accelWakeWord === 'boolean'),
);
check('Blind / low vision turns Accel on', PROFILE_PRESETS['blind-low-vision'].accelEnabled === true && PROFILE_PRESETS['blind-low-vision'].accelWakeWord === true);
check(
  'the others turn it off (Blind → Mute: Accel off)',
  (['none', 'deaf-hoh', 'mute-speech'] as const).every((id) => PROFILE_PRESETS[id].accelEnabled === false && PROFILE_PRESETS[id].accelWakeWord === false),
);

console.log('\nquick replies');
const BLIND = 'Please read it to me';
const MUTE = "I can't speak, I'll type my answer";
check(
  'a list never changed becomes the new profile\'s',
  JSON.stringify(quickRepliesAfterSwitch(suggestedQuickReplies('blind-low-vision'), 'blind-low-vision', 'mute-speech')) ===
    JSON.stringify(suggestedQuickReplies('mute-speech')),
);
const edited = [BLIND, 'Thank you', 'Where is the jeep to Dagupan?'];
const switched = quickRepliesAfterSwitch(edited, 'blind-low-vision', 'mute-speech');
check(
  "an edited list: the old profile's phrase goes, the new one comes first, the user's own stay",
  JSON.stringify(switched) === JSON.stringify([MUTE, 'Thank you', 'Where is the jeep to Dagupan?']),
  switched,
);
const reworded = ['Please read it to me slowly', 'Thank you'];
check(
  "the old phrase reworded by the user is the user's own now: it stays",
  quickRepliesAfterSwitch(reworded, 'blind-low-vision', 'none').includes('Please read it to me slowly'),
);
check('never twice', quickRepliesAfterSwitch([MUTE, 'Yes'], 'none', 'mute-speech').filter((reply) => reply === MUTE).length === 1);
const full = Array.from({ length: MAX_QUICK_REPLIES }, (_, i) => `Reply ${i + 1}`);
check(`a full list (${MAX_QUICK_REPLIES}) gets no new phrase`, JSON.stringify(quickRepliesAfterSwitch(full, 'none', 'mute-speech')) === JSON.stringify(full));
check('the same profile again changes nothing', JSON.stringify(quickRepliesAfterSwitch(edited, 'blind-low-vision', 'blind-low-vision')) === JSON.stringify(edited));
check(
  'a new account (onboarding: from the standard list) gets its profile\'s list',
  JSON.stringify(quickRepliesAfterSwitch(suggestedQuickReplies('none'), 'none', 'deaf-hoh')) === JSON.stringify(suggestedQuickReplies('deaf-hoh')),
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
