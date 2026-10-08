import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import type { IconName } from '@/constants/onboarding';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';

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
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);

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
        {selected ? <Ionicons name="checkmark" size={14} color={colors.onPrimary} /> : null}
      </View>
    </TouchableOpacity>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.colors.surface,
      borderWidth: 1.5,
      borderColor: t.colors.border,
      borderRadius: 16,
      padding: 14,
      marginBottom: 12,
    },
    cardSelected: {
      borderColor: t.colors.primary,
      backgroundColor: t.colors.primaryLight,
    },
    iconBox: {
      width: 40,
      height: 40,
      borderRadius: 10,
      backgroundColor: t.colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    textColumn: {
      flex: 1,
    },
    title: {
      fontSize: t.font(14),
      fontWeight: t.weight('700'),
      color: t.colors.textPrimary,
      marginBottom: 2,
    },
    description: {
      fontSize: t.font(12),
      color: t.colors.textSecondary,
    },
    radioOuter: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: t.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 8,
    },
    radioOuterSelected: {
      backgroundColor: t.colors.primary,
      borderColor: t.colors.primary,
    },
  });
