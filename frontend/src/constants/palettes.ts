/**
 * Every color scheme the app can show. All palettes have exactly the same
 * keys, so a screen never needs to know which one is active — it just reads
 * `colors.<key>` from useAppTheme().
 *
 * Contrast targets: text ≥ 4.5:1 against what it sits on (≥ 7:1 in the
 * high-contrast and yellow-on-black palettes), borders and icons ≥ 3:1.
 * `node --no-warnings scripts/check-contrast.mjs` checks every pair.
 *
 * Color is never the only signal (SOS, errors, "listening" and online status
 * always come with an icon or a word too), which is what keeps the
 * color-blind palettes honest.
 *
 * This file deliberately imports nothing, so the contrast check can run it
 * with plain Node.
 */

export type Palette = {
  isDark: boolean;
  /** Screen background. */
  background: string;
  /** Cards, sheets, inputs and anything else drawn on the background. */
  surface: string;
  /** The web canvas around the app column, and quiet badges. */
  surfaceAlt: string;
  border: string;
  /** Input and control outlines — strong enough to see (≥ 3:1). */
  inputBorder: string;
  textPrimary: string;
  textSecondary: string;
  /** Hints and placeholders. Still ≥ 4.5:1. */
  textMuted: string;
  /** Buttons, links, selected states. Also readable as text. */
  primary: string;
  /** Text and icons drawn on `primary`. */
  onPrimary: string;
  /** A soft tint of `primary` for chips and icon backgrounds. */
  primaryLight: string;
  /** Text and icons drawn on `primaryLight`. */
  onPrimaryLight: string;
  /** SOS, delete and other destructive fills. */
  danger: string;
  onDanger: string;
  /** Error text on the background. */
  dangerText: string;
  success: string;
  bubbleMe: string;
  onBubbleMe: string;
  bubbleThem: string;
  onBubbleThem: string;
  /** The "microphone is listening" indicator. */
  listening: string;
  onListening: string;
  /** The dark AI-mode banner on Home. */
  banner: string;
  onBanner: string;
  /** Modal backdrops. */
  overlay: string;
};

export type PaletteFamily =
  | 'standard'
  | 'high-contrast'
  | 'yellow-on-black'
  | 'red-green-safe'
  | 'blue-yellow-safe';

const standardLight: Palette = {
  isDark: false,
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#F4F2FB',
  border: '#E5E7EB',
  inputBorder: '#8A8F99',
  textPrimary: '#1A1A2E',
  textSecondary: '#4B5563',
  textMuted: '#5F6670',
  primary: '#5B4BD6',
  onPrimary: '#FFFFFF',
  primaryLight: '#EFEAFE',
  onPrimaryLight: '#4434B8',
  danger: '#C62828',
  onDanger: '#FFFFFF',
  dangerText: '#C62828',
  success: '#2E7D32',
  bubbleMe: '#5B4BD6',
  onBubbleMe: '#FFFFFF',
  bubbleThem: '#FFFFFF',
  onBubbleThem: '#1A1A2E',
  listening: '#C62828',
  onListening: '#FFFFFF',
  banner: '#241F3D',
  onBanner: '#FFFFFF',
  overlay: 'rgba(20, 16, 36, 0.5)',
};

const standardDark: Palette = {
  isDark: true,
  background: '#121019',
  surface: '#1E1A2E',
  surfaceAlt: '#0B0910',
  border: '#36314D',
  inputBorder: '#7A7596',
  textPrimary: '#F4F2FB',
  textSecondary: '#CFCBE0',
  textMuted: '#ABA6C2',
  primary: '#A29BFE',
  onPrimary: '#14112B',
  primaryLight: '#2C2650',
  onPrimaryLight: '#D3CEFF',
  danger: '#EF5350',
  onDanger: '#1A0505',
  dangerText: '#FF8A80',
  success: '#81C784',
  bubbleMe: '#4C3FC2',
  onBubbleMe: '#FFFFFF',
  bubbleThem: '#2A2540',
  onBubbleThem: '#F4F2FB',
  listening: '#EF5350',
  onListening: '#1A0505',
  banner: '#2C2650',
  onBanner: '#FFFFFF',
  overlay: 'rgba(0, 0, 0, 0.65)',
};

const highContrastLight: Palette = {
  isDark: false,
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#FFFFFF',
  border: '#000000',
  inputBorder: '#000000',
  textPrimary: '#000000',
  textSecondary: '#1A1A1A',
  textMuted: '#333333',
  primary: '#2E1FA8',
  onPrimary: '#FFFFFF',
  primaryLight: '#E8E5FF',
  onPrimaryLight: '#1C1270',
  danger: '#A00018',
  onDanger: '#FFFFFF',
  dangerText: '#A00018',
  success: '#1B5E20',
  bubbleMe: '#2E1FA8',
  onBubbleMe: '#FFFFFF',
  bubbleThem: '#FFFFFF',
  onBubbleThem: '#000000',
  listening: '#A00018',
  onListening: '#FFFFFF',
  banner: '#000000',
  onBanner: '#FFFFFF',
  overlay: 'rgba(0, 0, 0, 0.7)',
};

const highContrastDark: Palette = {
  isDark: true,
  background: '#000000',
  surface: '#000000',
  surfaceAlt: '#000000',
  border: '#FFFFFF',
  inputBorder: '#FFFFFF',
  textPrimary: '#FFFFFF',
  textSecondary: '#F2F2F2',
  textMuted: '#D9D9D9',
  primary: '#C9C2FF',
  onPrimary: '#000000',
  primaryLight: '#1A1640',
  onPrimaryLight: '#E4E0FF',
  danger: '#FF8A80',
  onDanger: '#000000',
  dangerText: '#FF8A80',
  success: '#B9F6CA',
  bubbleMe: '#C9C2FF',
  onBubbleMe: '#000000',
  bubbleThem: '#000000',
  onBubbleThem: '#FFFFFF',
  listening: '#FF8A80',
  onListening: '#000000',
  banner: '#1A1640',
  onBanner: '#FFFFFF',
  overlay: 'rgba(0, 0, 0, 0.8)',
};

// Dark only. A long-standing low-vision scheme: bright yellow on black cuts
// glare and suits cataracts and macular degeneration.
const yellowOnBlack: Palette = {
  isDark: true,
  background: '#000000',
  surface: '#000000',
  surfaceAlt: '#000000',
  border: '#FFEB3B',
  inputBorder: '#FFEB3B',
  textPrimary: '#FFEB3B',
  textSecondary: '#FFF176',
  textMuted: '#FFF59D',
  primary: '#FFEB3B',
  onPrimary: '#000000',
  primaryLight: '#262000',
  onPrimaryLight: '#FFEB3B',
  danger: '#FF8A80',
  onDanger: '#000000',
  dangerText: '#FF8A80',
  success: '#FFFFFF',
  bubbleMe: '#FFEB3B',
  onBubbleMe: '#000000',
  bubbleThem: '#000000',
  onBubbleThem: '#FFEB3B',
  listening: '#FF8A80',
  onListening: '#000000',
  banner: '#262000',
  onBanner: '#FFEB3B',
  overlay: 'rgba(0, 0, 0, 0.8)',
};

// Protanopia / deuteranopia (red-green). Built on the Okabe-Ito colors: blue
// for the brand, vermillion/orange for danger, so SOS and errors never rely
// on telling red from green.
const redGreenSafeLight: Palette = {
  ...standardLight,
  primary: '#0067A3',
  primaryLight: '#E1F0FA',
  onPrimaryLight: '#004E7C',
  danger: '#A84A00',
  dangerText: '#A84A00',
  success: '#0067A3',
  bubbleMe: '#0067A3',
  listening: '#A84A00',
  banner: '#0B2A3D',
  surfaceAlt: '#EEF5FA',
};

const redGreenSafeDark: Palette = {
  ...standardDark,
  background: '#0F1418',
  surface: '#1A2229',
  surfaceAlt: '#090C0F',
  border: '#2F3B45',
  inputBorder: '#71828F',
  textPrimary: '#F2F6F9',
  textSecondary: '#CAD5DD',
  textMuted: '#A5B3BE',
  primary: '#56B4E9',
  onPrimary: '#04141E',
  primaryLight: '#123247',
  onPrimaryLight: '#BFE3F7',
  danger: '#E69F00',
  onDanger: '#1A1200',
  dangerText: '#F5B841',
  success: '#56B4E9',
  bubbleMe: '#0067A3',
  onBubbleMe: '#FFFFFF',
  bubbleThem: '#24303A',
  onBubbleThem: '#F2F6F9',
  listening: '#E69F00',
  onListening: '#1A1200',
  banner: '#123247',
};

// Tritanopia (blue-yellow). Teal for the brand, red for danger, pink for
// "listening" — never asks anyone to tell blue from yellow.
const blueYellowSafeLight: Palette = {
  ...standardLight,
  primary: '#00695C',
  primaryLight: '#E0F2F1',
  onPrimaryLight: '#004D43',
  danger: '#C62828',
  dangerText: '#C62828',
  success: '#1B5E20',
  bubbleMe: '#00695C',
  listening: '#AD1457',
  banner: '#0F2E2A',
  surfaceAlt: '#EEF6F5',
};

const blueYellowSafeDark: Palette = {
  ...standardDark,
  background: '#111414',
  surface: '#1C2221',
  surfaceAlt: '#0A0C0C',
  border: '#313B3A',
  inputBorder: '#76847F',
  textPrimary: '#F1F6F5',
  textSecondary: '#CBD6D4',
  textMuted: '#A7B4B1',
  primary: '#4DB6AC',
  onPrimary: '#03201C',
  primaryLight: '#123A35',
  onPrimaryLight: '#B8E6E1',
  danger: '#EF9A9A',
  onDanger: '#2A0505',
  dangerText: '#EF9A9A',
  success: '#A5D6A7',
  bubbleMe: '#00695C',
  onBubbleMe: '#FFFFFF',
  bubbleThem: '#253230',
  onBubbleThem: '#F1F6F5',
  listening: '#F48FB1',
  onListening: '#2A0514',
  banner: '#123A35',
};

export const PALETTES: Record<PaletteFamily, { light: Palette; dark: Palette }> = {
  standard: { light: standardLight, dark: standardDark },
  'high-contrast': { light: highContrastLight, dark: highContrastDark },
  // Same palette either way: the scheme only exists as yellow on black.
  'yellow-on-black': { light: yellowOnBlack, dark: yellowOnBlack },
  'red-green-safe': { light: redGreenSafeLight, dark: redGreenSafeDark },
  'blue-yellow-safe': { light: blueYellowSafeLight, dark: blueYellowSafeDark },
};

/** Families that look the same in light and dark mode. */
export const DARK_ONLY_FAMILIES: readonly PaletteFamily[] = ['yellow-on-black'];

export const PALETTE_OPTIONS: { id: PaletteFamily; label: string; description: string }[] = [
  { id: 'standard', label: 'Standard', description: 'The usual AccessAI colors.' },
  { id: 'high-contrast', label: 'High contrast', description: 'Black and white, strongest contrast. For low vision.' },
  { id: 'yellow-on-black', label: 'Yellow on black', description: 'Less glare. Always dark.' },
  { id: 'red-green-safe', label: 'Red-green safe', description: 'For red-green color blindness. Uses blue and orange.' },
  { id: 'blue-yellow-safe', label: 'Blue-yellow safe', description: 'For blue-yellow color blindness. Uses teal, red and pink.' },
];
