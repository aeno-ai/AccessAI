import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ConsentCheckbox } from '@/components/ui/ConsentCheckbox';
import { PWD_DECLARATION } from '@/constants/legal';

import type { UserRole } from '@/hooks/use-bootstrap';
import { useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';

type RoleSelectorProps = {
  role: UserRole | null;
  onRoleChange: (role: UserRole) => void;
  pwdDeclared: boolean;
  onPwdDeclaredChange: (declared: boolean) => void;
};

/**
 * The "I am PWD / Non-PWD" choice, plus the PWD declaration that comes with
 * choosing PWD. Used by both ways of signing up (email and Google).
 */
export function RoleSelector({ role, onRoleChange, pwdDeclared, onPwdDeclaredChange }: RoleSelectorProps) {
  const styles = useThemedStyles(makeStyles);

  const chooseRole = (next: UserRole) => {
    onRoleChange(next);
    // The declaration only ever counts for the PWD choice it was ticked
    // under — switching away (and back) means ticking it again.
    if (next !== 'pwd') {
      onPwdDeclaredChange(false);
    }
  };

  return (
    <View style={styles.roleContainer}>
      <Text style={styles.label}>I am</Text>
      <View style={styles.roleToggle} accessibilityRole="radiogroup">
        <TouchableOpacity
          style={[styles.roleOption, role === 'pwd' && styles.roleOptionActive]}
          onPress={() => chooseRole('pwd')}
          accessibilityRole="radio"
          accessibilityState={{ selected: role === 'pwd' }}
        >
          <Text style={[styles.roleText, role === 'pwd' && styles.roleTextActive]}>PWD</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.roleOption, role === 'non_pwd' && styles.roleOptionActive]}
          onPress={() => chooseRole('non_pwd')}
          accessibilityRole="radio"
          accessibilityState={{ selected: role === 'non_pwd' }}
        >
          <Text style={[styles.roleText, role === 'non_pwd' && styles.roleTextActive]}>Non-PWD</Text>
        </TouchableOpacity>
      </View>

      {role === 'pwd' ? (
        <View style={styles.declarationCard}>
          <Text style={styles.declarationTitle} accessibilityRole="header">
            {PWD_DECLARATION.title}
          </Text>
          <Text style={styles.declarationText}>{PWD_DECLARATION.intro}</Text>
          {PWD_DECLARATION.points.map((point) => (
            <View key={point} style={styles.declarationPoint}>
              <Text style={styles.declarationBullet}>{'•'}</Text>
              <Text style={styles.declarationPointText}>{point}</Text>
            </View>
          ))}
          <ConsentCheckbox
            checked={pwdDeclared}
            onChange={onPwdDeclaredChange}
            label={PWD_DECLARATION.confirmation}
          />
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    label: {
      color: t.colors.primary,
      fontWeight: t.weight('600'),
      marginBottom: 6,
      fontSize: t.font(14),
    },
    roleContainer: {
      width: '100%',
      marginBottom: 16,
    },
    roleToggle: {
      flexDirection: 'row',
      gap: 10,
    },
    roleOption: {
      flex: 1,
      borderWidth: 1,
      borderColor: t.colors.inputBorder,
      borderRadius: 12,
      paddingVertical: 12,
      alignItems: 'center',
      backgroundColor: t.colors.surface,
    },
    roleOptionActive: {
      backgroundColor: t.colors.primary,
      borderColor: t.colors.primary,
    },
    roleText: {
      color: t.colors.textPrimary,
      fontWeight: t.weight('600'),
    },
    roleTextActive: {
      color: t.colors.onPrimary,
    },
    declarationCard: {
      marginTop: 12,
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: t.colors.primary,
      backgroundColor: t.colors.primaryLight,
    },
    declarationTitle: {
      fontSize: t.font(15),
      fontWeight: t.weight('700'),
      color: t.colors.textPrimary,
      marginBottom: 6,
    },
    declarationText: {
      fontSize: t.font(13),
      lineHeight: t.lineHeight(19),
      color: t.colors.textPrimary,
      marginBottom: 6,
    },
    declarationPoint: {
      flexDirection: 'row',
      marginBottom: 4,
    },
    declarationBullet: {
      width: 14,
      fontSize: t.font(13),
      lineHeight: t.lineHeight(19),
      color: t.colors.primary,
    },
    declarationPointText: {
      flex: 1,
      fontSize: t.font(13),
      lineHeight: t.lineHeight(19),
      color: t.colors.textPrimary,
    },
  });
