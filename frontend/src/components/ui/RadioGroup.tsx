import { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';

export type RadioOption<T> = {
  value: T;
  label: string;
  description?: string;
  /** Drawn at the start of the row, e.g. a color swatch. Hidden from screen readers. */
  preview?: ReactNode;
};

type RadioGroupProps<T> = {
  /** Read out when focus enters the group, e.g. "Text size". */
  label: string;
  options: RadioOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
};

/**
 * A vertical list of choices where exactly one is selected. Vertical rather
 * than side-by-side segments so long labels and large text never get cut
 * off. Each row is a screen-reader "radio button" announcing "selected" /
 * "not selected", and "1 of 4".
 */
export function RadioGroup<T extends string | number>({ label, options, value, onChange, disabled }: RadioGroupProps<T>) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.group}>
      {options.map((option, index) => {
        const checked = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            onPress={() => onChange(option.value)}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityLabel={option.description ? `${option.label}. ${option.description}` : option.label}
            accessibilityState={{ checked, disabled: Boolean(disabled) }}
            accessibilityHint={`${index + 1} of ${options.length}`}
            style={({ pressed }) => [
              styles.row,
              index > 0 && styles.rowDivider,
              checked && styles.rowChecked,
              disabled && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            {option.preview ? (
              <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
                {option.preview}
              </View>
            ) : null}
            <View style={styles.text}>
              <Text style={[styles.label, checked && styles.labelChecked]}>{option.label}</Text>
              {option.description ? <Text style={styles.description}>{option.description}</Text> : null}
            </View>
            <Ionicons
              name={checked ? 'radio-button-on' : 'radio-button-off'}
              size={24}
              color={checked ? colors.primary : colors.inputBorder}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    group: {
      borderWidth: 1,
      borderColor: t.colors.border,
      borderRadius: 14,
      backgroundColor: t.colors.surface,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 56,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    rowDivider: {
      borderTopWidth: 1,
      borderTopColor: t.colors.border,
    },
    rowChecked: {
      backgroundColor: t.colors.primaryLight,
    },
    text: {
      flex: 1,
    },
    label: {
      fontSize: t.font(15),
      fontWeight: t.weight('600'),
      color: t.colors.textPrimary,
    },
    labelChecked: {
      color: t.colors.onPrimaryLight,
      fontWeight: t.weight('700'),
    },
    description: {
      marginTop: 2,
      fontSize: t.font(13),
      lineHeight: t.lineHeight(18),
      color: t.colors.textSecondary,
    },
    disabled: {
      opacity: 0.45,
    },
    pressed: {
      opacity: 0.75,
    },
  });
