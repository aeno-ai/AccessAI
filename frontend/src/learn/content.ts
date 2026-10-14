// Learn's content — the one file to edit. Each course (fsl, asl) has:
//   COURSES: the real units. Each sign's `label` must be exactly a word the
//     sign reader learned (ai/models/sign/<fsl|asl>/words/labels.json —
//     `npx tsx scripts/learn-check.ts` checks it). Every 4 signs make a lesson,
//     and each unit ends with a review (lessons.ts).
//   LOCKED: the levels shown after the real ones — a title and an icon only,
//     always locked ("Finish previous levels first.").
// A sign's clip is assets/signs/<fsl|asl>/<clip>.mp4; until it's recorded the
// app shows "Clip coming soon". `steps` are read out to blind and low-vision
// learners, so they describe the hands only and never say the word.
import type { Course, LockedUnit, UnitContent } from './types';

export const COURSES: Record<Course, UnitContent[]> = {
  fsl: [
    {
      id: 'first-signs',
      title: 'First signs',
      signs: [
        // Lesson 1
        {
          label: 'HELLO',
          display: 'Hello',
          easy: false,
          clip: 'hello',
          steps: [
            'Hold your right hand up beside your forehead, fingers together, palm facing out.',
            'Move it out and away from your head, like a small salute.',
          ],
        },
        {
          label: 'GOOD AFTERNOON',
          display: 'Good afternoon',
          easy: true,
          clip: 'good-afternoon',
          steps: [
            'Touch the fingertips of your flat right hand to your chin.',
            'Move the hand forward and down.',
            'Then rest your right forearm on the back of your left hand, right hand flat and pointing forward and a little down.',
          ],
        },
        {
          label: 'HOW ARE YOU',
          display: 'How are you?',
          easy: true,
          clip: 'how-are-you',
          steps: [
            'Hold both hands in front of your chest, fingers bent, the backs of the fingers touching.',
            'Roll both hands forward and up until the palms face up.',
            'Then point your index finger at the other person.',
          ],
        },
        {
          label: 'NICE TO MEET YOU',
          display: 'Nice to meet you',
          easy: true,
          clip: 'nice-to-meet-you',
          steps: [
            'Slide your flat right palm across your flat left palm, from the wrist to the fingertips.',
            'Hold up both index fingers apart, then bring them together in front of you.',
            'Then point your index finger at the other person.',
          ],
        },
        // Lesson 2
        {
          label: 'IM FINE',
          display: "I'm fine",
          easy: false,
          clip: 'im-fine',
          steps: [
            'Point your index finger at your own chest.',
            'Then spread the fingers of your right hand and tap your thumb on your chest.',
          ],
        },
        {
          label: 'THANK YOU',
          display: 'Thank you',
          easy: false,
          clip: 'thank-you',
          steps: [
            'Touch the fingertips of your flat right hand to your chin.',
            'Move the hand forward and down toward the other person, palm up.',
          ],
        },
        {
          label: 'YOURE WELCOME',
          display: "You're welcome",
          easy: false,
          clip: 'youre-welcome',
          steps: [
            'Hold your right hand out to the side, flat, palm up.',
            'Sweep it in toward your waist, like inviting someone in.',
          ],
        },
        {
          label: 'SEE YOU TOMORROW',
          display: 'See you tomorrow',
          easy: false,
          clip: 'see-you-tomorrow',
          steps: [
            'Make a V with your index and middle fingers and touch them just under your eyes.',
            'Move the hand forward, away from your face.',
            'Then make a fist, thumb up, touch the thumb to your cheek and move it forward.',
          ],
        },
        // Lesson 3
        {
          label: 'YES',
          display: 'Yes',
          easy: false,
          clip: 'yes',
          steps: ['Make a fist with your right hand.', 'Bend it up and down at the wrist, like a head nodding.'],
        },
        {
          label: 'NO',
          display: 'No',
          easy: true,
          clip: 'no',
          steps: [
            'Hold your index and middle fingers together, your thumb under them.',
            'Snap the two fingers down onto your thumb.',
          ],
        },
        {
          label: 'KNOW',
          display: 'Know',
          easy: true,
          clip: 'know',
          steps: ['Bring your flat right hand up to the side of your forehead.', 'Tap your fingertips on your forehead.'],
        },
        {
          label: 'DON’T KNOW',
          display: "Don't know",
          easy: true,
          clip: 'dont-know',
          steps: [
            'Touch the fingertips of your flat right hand to the side of your forehead.',
            'Then turn the hand outward and move it away, palm facing forward.',
          ],
        },
      ],
    },
  ],

  asl: [
    {
      id: 'first-signs',
      title: 'First signs',
      signs: [
        // Lesson 1
        {
          label: 'help',
          display: 'Help',
          easy: true,
          clip: 'help',
          steps: [
            'Make a fist with your right hand, thumb pointing up.',
            'Rest the fist on your flat left palm.',
            'Lift both hands up together.',
          ],
        },
        {
          label: 'please',
          display: 'Please',
          easy: false,
          clip: 'please',
          steps: ['Put your flat right hand on your chest.', 'Rub it around in a circle.'],
        },
        {
          label: 'thank you',
          display: 'Thank you',
          easy: false,
          clip: 'thank-you',
          steps: [
            'Touch the fingertips of your flat right hand to your chin.',
            'Move the hand forward and down toward the other person, palm up.',
          ],
        },
        {
          label: 'sorry',
          display: 'Sorry',
          easy: false,
          clip: 'sorry',
          steps: ['Make a fist with your right hand.', 'Rub it around in a circle on your chest.'],
        },
        // Lesson 2
        {
          label: 'yes',
          display: 'Yes',
          easy: false,
          clip: 'yes',
          steps: ['Make a fist with your right hand.', 'Bend it up and down at the wrist, like a head nodding.'],
        },
        {
          label: 'no',
          display: 'No',
          easy: false,
          clip: 'no',
          steps: [
            'Hold your index and middle fingers together, your thumb under them.',
            'Snap the two fingers down onto your thumb, twice.',
          ],
        },
        {
          label: 'understand',
          display: 'Understand',
          easy: false,
          clip: 'understand',
          steps: ['Hold your right fist beside your forehead, palm facing you.', 'Flick your index finger up.'],
        },
        {
          label: 'again',
          display: 'Again',
          easy: false,
          clip: 'again',
          steps: [
            'Hold your left hand flat, palm up.',
            'Bend the fingers of your right hand and turn it over.',
            'Touch your fingertips down into the middle of your left palm.',
          ],
        },
        // Lesson 3
        {
          label: 'name',
          display: 'Name',
          easy: false,
          clip: 'name',
          steps: [
            'On both hands, hold the index and middle fingers together and straight, pointing sideways.',
            'Cross your right fingers over your left fingers.',
            'Tap them together twice.',
          ],
        },
        {
          label: 'meet',
          display: 'Meet',
          easy: true,
          clip: 'meet',
          steps: [
            'Hold up both index fingers a little apart, palms facing each other.',
            'Bring your hands together until they touch.',
          ],
        },
        {
          label: 'how',
          display: 'How',
          easy: true,
          clip: 'how',
          steps: [
            'Hold both hands in front of your chest, fingers bent, the backs of the fingers touching.',
            'Roll both hands forward and up until the palms face up.',
          ],
        },
        {
          label: 'fine',
          display: 'Fine',
          easy: false,
          clip: 'fine',
          steps: ['Spread the fingers of your right hand wide.', 'Tap your thumb on your chest.'],
        },
      ],
    },
  ],
};

/** A locked topic: its lessons and its review, titles and icons only. */
const locked = (title: string, lessons: number): LockedUnit => ({
  title,
  levels: [
    ...Array.from({ length: lessons }, (_, i) => ({ title: `Lesson ${i + 1}`, icon: 'lock-closed-outline' as const })),
    { title: 'Review', icon: 'lock-closed-outline' as const },
  ],
});

/** Shown after the real units. FSL 36 and ASL 33 levels: the course keeps its full length. */
export const LOCKED: Record<Course, LockedUnit[]> = {
  fsl: [
    locked('Numbers', 3),
    locked('Days and time', 3),
    locked('Months', 3),
    locked('Colours', 4),
    locked('Family and people', 4),
    locked('Food and drink', 5),
    locked('Describing', 3),
    locked('Who I am', 3),
  ],
  asl: [
    locked('People and family', 3),
    locked('Colours', 3),
    locked('Food and drink', 4),
    locked('Things', 3),
    locked('Actions', 5),
    locked('Describing', 2),
    locked('Places and time', 3),
    locked('Animals and sports', 2),
  ],
};
