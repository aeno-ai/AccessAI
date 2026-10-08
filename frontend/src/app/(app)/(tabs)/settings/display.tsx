import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { RadioGroup } from '@/components/ui/RadioGroup';
import { SectionHeader } from '@/components/ui/SettingRow';
import { ToggleRow } from '@/components/ui/ToggleRow';
import { DARK_ONLY_FAMILIES, PALETTE_OPTIONS, PALETTES, type PaletteFamily } from '@/constants/palettes';
import { Spacing } from '@/constants/theme';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { usePreferences, type TextScale, type ThemeMode } from '@/hooks/use-preferences';

const THEME_OPTIONS: { value: ThemeMode; label: string; description?: string }[] = [
  { value: 'system', label: 'Follow my phone', description: 'Light or dark, whatever your phone uses.' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const TEXT_SIZE_OPTIONS: { value: TextScale; label: string }[] = [
  { value: 1, label: 'Default' },
  { value: 1.15, label: 'Large' },
  { value: 1.3, label: 'Larger' },
  { value: 1.5, label: 'Largest' },
];

/** Three dots showing a palette's background, brand and SOS colors. */
function Swatch({ family, dark }: { family: PaletteFamily; dark: boolean }) {
  const styles = useThemedStyles(makeStyles);
  const palette = PALETTES[family][dark ? 'dark' : 'light'];
  return (
    <View style={[styles.swatch, { backgroundColor: palette.background, borderColor: palette.border }]}>
      <View style={[styles.swatchDot, { backgroundColor: palette.primary }]} />
      <View style={[styles.swatchDot, { backgroundColor: palette.danger }]} />
      <View style={[styles.swatchDot, { backgroundColor: palette.textPrimary }]} />
    </View>
  );
}

export default function DisplayScreen() {
  const { prefs, setPref } = usePreferences();
  const { isDark } = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const themeLocked = DARK_ONLY_FAMILIES.includes(prefs.palette);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Live preview: everything below changes it straight away. */}
      <View style={styles.preview} accessible accessibilityLabel="Preview of how text will look">
        <Text style={styles.previewTitle}>Hello, this is a preview.</Text>
        <Text style={styles.previewBody}>Messages and buttons across the app will look like this.</Text>
        <View style={styles.previewBubble}>
          <Text style={styles.previewBubbleText}>Salamat po!</Text>
        </View>
      </View>

      <SectionHeader title="Text size" />
      <RadioGroup
        label="Text size"
        value={prefs.textScale}
        onChange={(value) => setPref('textScale', value)}
        options={TEXT_SIZE_OPTIONS}
      />
      <Text style={styles.note}>Your phone&apos;s own font size setting also applies on top of this.</Text>

      <SectionHeader title="Text style" />
      <View style={styles.card}>
        <ToggleRow label="Bold text" value={prefs.boldText} onValueChange={(value) => setPref('boldText', value)} />
        <ToggleRow
          divided
          label="More space between lines"
          value={prefs.relaxedSpacing}
          onValueChange={(value) => setPref('relaxedSpacing', value)}
        />
      </View>

      <SectionHeader title="Colors" />
      <RadioGroup
        label="Colors"
        value={prefs.palette}
        onChange={(value) => setPref('palette', value)}
        options={PALETTE_OPTIONS.map((option) => ({
          value: option.id,
          label: option.label,
          description: option.description,
          preview: <Swatch family={option.id} dark={isDark} />,
        }))}
      />

      <SectionHeader title="Light or dark" />
      <RadioGroup
        label="Light or dark"
        value={prefs.theme}
        onChange={(value) => setPref('theme', value)}
        options={THEME_OPTIONS}
        disabled={themeLocked}
      />
      {themeLocked ? <Text style={styles.note}>Yellow on black is always dark.</Text> : null}

      <SectionHeader title="Motion" />
      <View style={styles.card}>
        <ToggleRow
          label="Reduce motion"
          description="Turns off pulsing and moving effects. Also follows your phone's setting."
          value={prefs.reduceMotion}
          onValueChange={(value) => setPref('reduceMotion', value)}
        />
      </View>
    </ScrollView>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
    content: {
      padding: Spacing.four,
      paddingBottom: Spacing.six,
    },
    preview: {
      borderWidth: 1,
      borderColor: t.colors.border,
      borderRadius: 16,
      backgroundColor: t.colors.surface,
      padding: Spacing.three,
    },
    previewTitle: {
      fontSize: t.font(18),
      fontWeight: t.weight('800'),
      color: t.colors.textPrimary,
    },
    previewBody: {
      marginTop: 4,
      fontSize: t.font(14),
      lineHeight: t.lineHeight(20),
      color: t.colors.textSecondary,
    },
    previewBubble: {
      alignSelf: 'flex-end',
      marginTop: 12,
      backgroundColor: t.colors.bubbleMe,
      borderRadius: 16,
      borderBottomRightRadius: 4,
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    previewBubbleText: {
      fontSize: t.font(14),
      fontWeight: t.weight('400'),
      color: t.colors.onBubbleMe,
    },
    note: {
      marginTop: 8,
      fontSize: t.font(13),
      lineHeight: t.lineHeight(18),
      color: t.colors.textMuted,
    },
    card: {
      borderWidth: 1,
      borderColor: t.colors.border,
      borderRadius: 14,
      backgroundColor: t.colors.surface,
      overflow: 'hidden',
    },
    swatch: {
      flexDirection: 'row',
      gap: 4,
      padding: 6,
      borderRadius: 10,
      borderWidth: 1,
    },
    swatchDot: {
      width: 14,
      height: 14,
      borderRadius: 7,
    },
  });
