import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/theme';
import type { IconName } from '@/constants/onboarding';

interface SelectableOptionCardProps {
  icon: IconName;
  title: string;
  description: string;
  selected: boolean;
  onPress: () => void;
}

export default function SelectableOptionCard({
  icon,
  title,
  description,
  selected,
  onPress,
}: SelectableOptionCardProps) {
  return (
    <TouchableOpacity
      style={[styles.card, selected && styles.cardSelected]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
    >
      <View style={styles.iconBox}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <View style={styles.textColumn}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
        {selected ? <Ionicons name="checkmark" size={14} color={colors.white} /> : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  cardSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textColumn: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  description: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  radioOuterSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
});
