import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, type TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/theme';

type Props = TextInputProps & {
  label: string;
  isPassword?: boolean;
};

export function AuthInput({ label, isPassword, ...inputProps }: Props) {
  const [hidden, setHidden] = useState(isPassword);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrapper}>
        <TextInput
          style={styles.input}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={hidden}
          autoCapitalize="none"
          {...inputProps}
        />
        {isPassword ? (
          <TouchableOpacity onPress={() => setHidden(!hidden)} hitSlop={10} accessibilityRole="button">
            <Ionicons name={hidden ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 16,
  },
  label: {
    color: colors.primary,
    fontWeight: '600',
    marginBottom: 6,
    fontSize: 14,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 50,
    backgroundColor: colors.white,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.textDark,
  },
});
