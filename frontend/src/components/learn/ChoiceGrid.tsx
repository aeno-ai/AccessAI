import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';

export type Choice = { key: string; label: string; icon?: keyof typeof Ionicons.glyphMap };

type Props = {
  /** Read before the choices by screen readers, e.g. "What does this sign mean?". */
  label: string;
  choices: Choice[];
  selected: string | null;
  onSelect: (key: string) => void;
  /** After "Check": the right answer is marked, and a wrong pick too. Choices are locked. */
  answer?: string | null;
};

/** Big answer buttons, one per row. Never color alone: a mark and a word show right and wrong. */
export function ChoiceGrid({ label, choices, selected, onSelect, answer = null }: Props) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const locked = answer !== null;

  return (
    <View style={styles.grid} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {choices.map((choice) => {
        const isSelected = selected === choice.key;
        const isRight = locked && choice.key === answer;
        const isWrong = locked && isSelected && choice.key !== answer;
        const state = isRight ? ', right answer' : isWrong ? ', wrong' : '';
        return (
          <Pressable
            key={choice.key}
            style={({ pressed }) => [
              styles.choice,
              isSelected && styles.selected,
              isRight && styles.right,
              isWrong && styles.wrong,
              pressed && !locked && styles.pressed,
            ]}
            onPress={() => !locked && onSelect(choice.key)}
            disabled={locked}
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected, disabled: locked }}
            accessibilityLabel={`${choice.label}${state}`}
          >
            {choice.icon ? <Ionicons name={choice.icon} size={20} color={colors.primary} /> : null}
            <Text style={[styles.text, (isRight || isWrong) && styles.textStrong]}>{choice.label}</Text>
            {isRight ? <Ionicons name="checkmark-circle" size={22} color={colors.primary} /> : null}
            {isWrong ? <Ionicons name="close-circle" size={22} color={colors.dangerText} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    grid: {
      gap: 10,
    },
    choice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 56,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 14,
      borderWidth: 2,
      borderColor: t.colors.inputBorder,
      backgroundColor: t.colors.surface,
    },
    selected: {
      borderColor: t.colors.primary,
      backgroundColor: t.colors.primaryLight,
    },
    right: {
      borderColor: t.colors.primary,
      borderWidth: 3,
    },
    wrong: {
      borderColor: t.colors.dangerText,
      borderWidth: 3,
    },
    pressed: {
      opacity: 0.85,
    },
    text: {
      flex: 1,
      fontSize: t.font(17),
      fontWeight: t.weight('700'),
      color: t.colors.textPrimary,
    },
    textStrong: {
      fontWeight: t.weight('800'),
    },
  });
