import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AccessibilityInfo, useColorScheme, type TextStyle } from 'react-native';
import { DARK_ONLY_FAMILIES, PALETTES, type Palette, type PaletteFamily } from '@/constants/palettes';
import { usePreferences } from '@/hooks/use-preferences';

type FontWeight = NonNullable<TextStyle['fontWeight']>;

export type AppTheme = {
  colors: Palette;
  isDark: boolean;
  family: PaletteFamily;
  /** A font size, scaled by the user's text size setting. */
  font: (size: number) => number;
  /** A line height, scaled like the text and by the line spacing setting. */
  lineHeight: (height: number) => number;
  /** A font weight, one step heavier when "Bold text" is on. */
  weight: (weight: FontWeight) => FontWeight;
  /** True if the user asked for less motion here or in the phone's settings. */
  reduceMotion: boolean;
};

const BOLDER: Partial<Record<string, FontWeight>> = {
  normal: '600',
  '400': '600',
  '500': '700',
  '600': '700',
  '700': '800',
  '800': '900',
  bold: '800',
};

const AppThemeContext = createContext<AppTheme | null>(null);

/**
 * Turns the saved display preferences into the colors and sizes every screen
 * draws with. The phone's own font-size setting still applies on top of
 * `font()`, because React Native scales text by it automatically.
 */
export function AppThemeProvider({ children }: { children: ReactNode }) {
  const { prefs } = usePreferences();
  const systemScheme = useColorScheme();
  const [systemReduceMotion, setSystemReduceMotion] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!cancelled) setSystemReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setSystemReduceMotion);
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  const theme = useMemo<AppTheme>(() => {
    const wantsDark =
      DARK_ONLY_FAMILIES.includes(prefs.palette) ||
      prefs.theme === 'dark' ||
      (prefs.theme === 'system' && systemScheme === 'dark');
    const colors = PALETTES[prefs.palette][wantsDark ? 'dark' : 'light'];
    const scale = prefs.textScale;
    const spacing = prefs.relaxedSpacing ? 1.25 : 1;
    return {
      colors,
      isDark: colors.isDark,
      family: prefs.palette,
      font: (size) => Math.round(size * scale),
      lineHeight: (height) => Math.round(height * scale * spacing),
      weight: (weight) => (prefs.boldText ? (BOLDER[String(weight)] ?? weight) : weight),
      reduceMotion: prefs.reduceMotion || systemReduceMotion,
    };
  }, [prefs.palette, prefs.theme, prefs.textScale, prefs.relaxedSpacing, prefs.boldText, prefs.reduceMotion, systemScheme, systemReduceMotion]);

  return <AppThemeContext.Provider value={theme}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme(): AppTheme {
  const theme = useContext(AppThemeContext);
  if (!theme) {
    throw new Error('useAppTheme must be used inside AppThemeProvider');
  }
  return theme;
}

/**
 * Builds a component's styles from the current theme, rebuilding them only
 * when the theme changes. Define the factory outside the component:
 *
 *   const makeStyles = (t: AppTheme) => StyleSheet.create({ title: { color: t.colors.textPrimary } });
 *   const styles = useThemedStyles(makeStyles);
 */
export function useThemedStyles<T>(factory: (theme: AppTheme) => T): T {
  const theme = useAppTheme();
  return useMemo(() => factory(theme), [factory, theme]);
}
