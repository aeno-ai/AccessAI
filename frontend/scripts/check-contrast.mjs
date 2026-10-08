/**
 * Checks every palette in src/constants/palettes.ts against WCAG contrast
 * minimums. Run from `frontend/` with:
 *   node --no-warnings scripts/check-contrast.mjs
 * (Node 23.6+ reads the .ts palette file directly.) Exits with code 1 if any
 * pair fails.
 */
import { PALETTES } from '../src/constants/palettes.ts';

// [foreground, background] pairs that carry text.
const TEXT_PAIRS = [
  ['textPrimary', 'background'],
  ['textPrimary', 'surface'],
  ['textSecondary', 'background'],
  ['textSecondary', 'surface'],
  ['textMuted', 'background'],
  ['textMuted', 'surface'],
  ['textMuted', 'surfaceAlt'],
  ['primary', 'background'],
  ['primary', 'surface'],
  ['onPrimary', 'primary'],
  ['onPrimaryLight', 'primaryLight'],
  ['onDanger', 'danger'],
  ['dangerText', 'background'],
  ['dangerText', 'surface'],
  ['success', 'background'],
  ['onBubbleMe', 'bubbleMe'],
  ['onBubbleThem', 'bubbleThem'],
  ['onListening', 'listening'],
  ['onBanner', 'banner'],
];

// Non-text elements (outlines, the listening dot, filled buttons against the
// screen) only need 3:1 (WCAG 1.4.11).
const UI_PAIRS = [
  ['inputBorder', 'background'],
  ['inputBorder', 'surface'],
  ['listening', 'background'],
  ['danger', 'background'],
  ['primary', 'background'],
];

const STRICT_FAMILIES = ['high-contrast', 'yellow-on-black'];

function luminance(hex) {
  const value = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(value.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

let failures = 0;
for (const [family, modes] of Object.entries(PALETTES)) {
  const textMin = STRICT_FAMILIES.includes(family) ? 7 : 4.5;
  for (const mode of ['light', 'dark']) {
    if (mode === 'dark' && modes.dark === modes.light) continue;
    const palette = modes[mode];
    const check = (pairs, min) => {
      for (const [fg, bg] of pairs) {
        const ratio = contrast(palette[fg], palette[bg]);
        if (ratio < min) {
          failures += 1;
          console.log(`FAIL ${family}/${mode}: ${fg} ${palette[fg]} on ${bg} ${palette[bg]} = ${ratio.toFixed(2)} (needs ${min})`);
        }
      }
    };
    check(TEXT_PAIRS, textMin);
    check(UI_PAIRS, 3);
  }
}

console.log(failures === 0 ? 'All palettes pass.' : `${failures} pair(s) below the minimum.`);
process.exit(failures === 0 ? 0 : 1);
