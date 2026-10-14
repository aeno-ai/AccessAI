// Checks that the app's speech never piles up (src/utils/speechHelper.ts):
//   npx tsx scripts/speech-check.ts
// The newest speech cuts off the old one; SOS speech is cut off only by
// more SOS speech or an SOS screen; a caller can stop only its own speech.
/// <reference types="node" />
import { engine } from './speech-check-stubs';
import { speakMixed, stopMixed } from '../src/utils/speechHelper';

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

const playing = () => engine.playing.map((utterance) => utterance.text);
const reset = () => {
  stopMixed({ sos: true });
  engine.said.length = 0;
};

async function main() {
  console.log('the newest speech wins');
  const first = speakMixed('Read the last message');
  const second = speakMixed('This is how fast I will speak');
  check('the first is cut off', (await first) === false);
  check('only the newest is playing', JSON.stringify(playing()) === '["This is how fast I will speak"]', playing());
  engine.finish();
  check('the newest is said to the end', (await second) === true);

  reset();
  const taps = [speakMixed('You said hello'), speakMixed('You said hello'), speakMixed('You said hello')];
  check('the same button tapped 3 times: it starts over, one reading left', engine.playing.length === 1, playing());
  engine.finish();
  check('…and only the last tap is said to the end', JSON.stringify(await Promise.all(taps)) === '[false,false,true]');

  reset();
  const long = speakMixed('First part, second part');
  const cutting = speakMixed('Accel here');
  check('a message cut off mid-way never says the rest', (await long) === false && !engine.said.some((text) => text.includes('second')), engine.said);
  engine.finish();
  await cutting;

  reset();
  let ended = 0;
  let done = 0;
  const counted = speakMixed('One', { onEnd: () => (ended += 1), onDone: () => (done += 1) });
  void speakMixed('Two');
  await counted;
  check('cut off: onEnd runs (a bubble shows "Read aloud" again), onDone does not', ended === 1 && done === 0, { ended, done });

  console.log('\nSOS speech');
  reset();
  const sos = speakMixed('Paul needs help', { sos: true });
  let skippedEnded = false;
  const ordinary = speakMixed('New message from Ana', { onEnd: () => (skippedEnded = true) });
  check('ordinary speech during SOS speech is skipped', (await ordinary) === false && !engine.said.includes('New message from Ana') && skippedEnded);
  stopMixed();
  stopMixed({ owner: 'accel' });
  check('a plain stop (Accel, the mic, a screen) leaves SOS speech playing', JSON.stringify(playing()) === '["Paul needs help"]', playing());
  const newer = speakMixed('Paul is 2 kilometers away', { sos: true });
  check('newer SOS speech replaces older SOS speech', (await sos) === false && JSON.stringify(playing()) === '["Paul is 2 kilometers away"]', playing());
  stopMixed({ sos: true });
  check("an SOS screen's own stop ends it", (await newer) === false && engine.playing.length === 0);

  console.log('\nstopping only your own speech');
  reset();
  const bubble = speakMixed('Hello from the bubble', { owner: 'bubble:1' });
  stopMixed({ owner: 'accel' });
  stopMixed({ owner: 'bubble:2' });
  check("Accel closing, or another bubble, leaves this bubble's reading alone", engine.playing.length === 1, playing());
  stopMixed({ owner: 'bubble:1' });
  check('a bubble stops its own reading', (await bubble) === false && engine.playing.length === 0);
  stopMixed();
  stopMixed({ owner: 'accel' });
  check('stopping when nothing is playing does nothing', engine.playing.length === 0);

  console.log("\na phone that doesn't report stops");
  reset();
  engine.reportsStops = false;
  const unreported = speakMixed('Read the last message');
  const replacing = speakMixed('Read the last message');
  check('the cut-off reading still ends (nothing waits forever)', (await unreported) === false);
  engine.finish();
  check('the new one is said to the end', (await replacing) === true);
  engine.reportsStops = true;

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

void main();
