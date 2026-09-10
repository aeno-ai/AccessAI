import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors } from '@/constants/theme';

type Props = {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
};

export function PrimaryButton({ title, onPress, loading, disabled }: Props) {
  return (
    <TouchableOpacity
      style={[styles.button, disabled ? styles.disabled : null]}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
    >
      {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.text}>{title}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  disabled: {
    opacity: 0.6,
  },
  text: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 16,
  },
});
