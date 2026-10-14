import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { usePreferences, type SignLanguage, type SignUnit } from '@/hooks/use-preferences';
import { signReady, type SignModelInfo } from '@/hooks/use-sign-recognition';

export const SIGN_LANGUAGE_NAMES: Record<SignLanguage, string> = {
  fsl: 'Filipino Sign Language',
  asl: 'American Sign Language',
};

/** "FSL · Words" — what the sign panel's button shows. */
export const signChoiceLabel = (language: SignLanguage, unit: SignUnit) =>
  `${language.toUpperCase()} · ${unit === 'letters' ? 'Letters' : 'Words'}`;

type CardProps = {
  title: string;
  description: string;
  selected: boolean;
  disabled?: boolean;
  onPress: () => void;
};

/** One big choice: a radio mark, a name and a short line under it. */
function ChoiceCard({ title, description, selected, disabled = false, onPress }: CardProps) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardSelected,
        disabled && styles.cardDisabled,
        pressed && !disabled && styles.pressed,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={`${title}. ${description}`}
    >
      <Ionicons
        name={selected ? 'radio-button-on' : 'radio-button-off'}
        size={24}
        color={disabled ? colors.textMuted : colors.primary}
      />
      <View style={styles.cardText}>
        <Text style={[styles.cardTitle, disabled && styles.textDisabled]}>{title}</Text>
        <Text style={styles.cardDescription}>{description}</Text>
      </View>
    </Pressable>
  );
}

/**
 * The sign language choices, as big cards: which language, and whether to
 * read whole signs (words) or spelling (letters). Letters stay "Coming soon"
 * until that model is on the server. Used in the camera's sheet and in
 * Settings → Sign language; both change the same saved setting.
 */
export function SignChoices({ models }: { models: SignModelInfo[] | null }) {
  const { prefs, setPref } = usePreferences();
  const styles = useThemedStyles(makeStyles);
  const lettersReady = signReady(models, prefs.signLanguage, 'letters');
  const unit: SignUnit = prefs.signUnit === 'letters' && !lettersReady ? 'words' : prefs.signUnit;

  return (
    <View style={styles.wrap}>
      <Text style={styles.groupTitle} accessibilityRole="header">
        Language
      </Text>
      <View accessibilityRole="radiogroup" style={styles.group}>
        {(['fsl', 'asl'] as const).map((language) => (
          <ChoiceCard
            key={language}
            title={SIGN_LANGUAGE_NAMES[language]}
            description={language.toUpperCase()}
            selected={prefs.signLanguage === language}
            onPress={() => {
              setPref('signLanguage', language);
              setPref('signLanguageChosen', true);
            }}
          />
        ))}
      </View>

      <Text style={styles.groupTitle} accessibilityRole="header">
        What to read
      </Text>
      <View accessibilityRole="radiogroup" style={styles.group}>
        <ChoiceCard
          title="Words"
          description="Whole signs, like HELLO or THANK YOU."
          selected={unit === 'words'}
          onPress={() => setPref('signUnit', 'words')}
        />
        <ChoiceCard
          title="Letters"
          description={lettersReady ? 'Spell names and words, letter by letter.' : 'Coming soon.'}
          selected={unit === 'letters'}
          disabled={!lettersReady}
          onPress={() => setPref('signUnit', 'letters')}
        />
      </View>
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    wrap: {
      gap: 8,
    },
    groupTitle: {
      marginTop: 8,
      fontSize: t.font(15),
      fontWeight: t.weight('800'),
      color: t.colors.textPrimary,
    },
    group: {
      gap: 8,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 64,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
    },
    cardSelected: {
      borderColor: t.colors.primary,
      backgroundColor: t.colors.primaryLight,
    },
    cardDisabled: {
      opacity: 0.6,
    },
    pressed: {
      opacity: 0.8,
    },
    cardText: {
      flex: 1,
    },
    cardTitle: {
      fontSize: t.font(16),
      fontWeight: t.weight('800'),
      color: t.colors.textPrimary,
    },
    cardDescription: {
      marginTop: 2,
      fontSize: t.font(14),
      lineHeight: t.lineHeight(19),
      color: t.colors.textSecondary,
    },
    textDisabled: {
      color: t.colors.textSecondary,
    },
  });
