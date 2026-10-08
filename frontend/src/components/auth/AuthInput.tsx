import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';

type Props = TextInputProps & {
  label: string;
  isPassword?: boolean;
};

export function AuthInput({ label, isPassword, ...inputProps }: Props) {
  const [hidden, setHidden] = useState(isPassword);
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.container}>
      {/* The input below carries the label itself, so it isn't read twice. */}
      <Text style={styles.label} importantForAccessibility="no" accessibilityElementsHidden>
        {label}
      </Text>
      <View style={styles.inputWrapper}>
        <TextInput
          style={styles.input}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={hidden}
          autoCapitalize="none"
          accessibilityLabel={label}
          {...inputProps}
        />
        {isPassword ? (
          <TouchableOpacity
            onPress={() => setHidden(!hidden)}
            style={styles.eyeButton}
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Show password' : 'Hide password'}
          >
            <Ionicons name={hidden ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: {
      width: '100%',
      marginBottom: 16,
    },
    label: {
      color: t.colors.primary,
      fontWeight: t.weight('600'),
      marginBottom: 6,
      fontSize: t.font(14),
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: t.colors.inputBorder,
      borderRadius: 12,
      paddingLeft: 14,
      // minHeight so large text isn't clipped.
      minHeight: 50,
      backgroundColor: t.colors.surface,
    },
    input: {
      flex: 1,
      paddingVertical: 10,
      paddingRight: 14,
      fontSize: t.font(15),
      color: t.colors.textPrimary,
    },
    eyeButton: {
      width: 48,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
