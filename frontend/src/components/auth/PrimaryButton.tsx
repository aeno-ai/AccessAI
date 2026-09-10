import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors } from '../../constants/theme';

type Props = { title: string; onPress: () => void; loading?: boolean; disabled?: boolean };

export function PrimaryButton({ title, onPress, loading, disabled }: Props) {
  return (
    <TouchableOpacity
      style={[styles.button, disabled ? styles.disabled : null]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.text}>{title}</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: { backgroundColor: colors.primary, borderRadius: 10, height: 50, justifyContent: 'center', alignItems: 'center', width: '100%' },
  disabled: { opacity: 0.6 },
  text: { color: '#fff', fontWeight: '700', fontSize: 16 },
});