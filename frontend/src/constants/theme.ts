import { Platform } from 'react-native';

export const colors = {
  primary: '#6C5CE7',
  primaryDark: '#4C3FE0',
  primaryLight: '#EFEAFE',
  background: '#FFFFFF',
  canvas: '#F4F2FB',
  inputBorder: '#E5E7EB',
  border: '#E5E7EB',
  textDark: '#1A1A2E',
  textPrimary: '#1A1A2E',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  white: '#FFFFFF',
  error: '#E74C3C',
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const MaxContentWidth = {
  onboarding: 480,
  auth: 420,
  app: 720,
} as const;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'system-ui, -apple-system, Segoe UI, sans-serif',
    serif: 'Georgia, serif',
    rounded: 'system-ui, sans-serif',
    mono: 'ui-monospace, monospace',
  },
});
