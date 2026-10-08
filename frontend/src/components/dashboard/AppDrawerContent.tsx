import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { DrawerContentScrollView, type DrawerContentComponentProps } from 'expo-router/drawer';
import { AppLogo } from '@/components/onboarding/Illustrations';
import { DeleteAccountModal } from '@/components/settings/DeleteAccountModal';
import { SectionHeader, SettingRow } from '@/components/ui/SettingRow';
import { Spacing } from '@/constants/theme';
import { useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { useBootstrap } from '@/hooks/use-bootstrap';
import { useFriends } from '@/realtime/FriendsProvider';

/**
 * Content shown inside the hamburger menu (a slide-out drawer on phone, a
 * persistent side panel on wide/web screens — see `(app)/_layout.tsx`).
 * Holds everything about the *account* — profile, terms, deleting it,
 * signing out — so the Settings tab can be purely accessibility preferences.
 */
export function AppDrawerContent(props: DrawerContentComponentProps) {
  const { signOut, firstName, role } = useBootstrap();
  const { friendCode } = useFriends();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const styles = useThemedStyles(makeStyles);

  const go = (path: '/profile' | '/terms' | '/emergency-contacts') => {
    props.navigation.closeDrawer();
    router.push(path);
  };

  // The backend has already stopped accepting this account's token, so
  // sign out here too rather than wait for the next request to 401.
  const handleDeletionScheduled = () => {
    setDeleteOpen(false);
    void signOut();
  };

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <AppLogo size={40} />
        <View style={styles.headerText}>
          <Text style={styles.wordmark}>PDAccessAI</Text>
          {firstName ? <Text style={styles.signedInAs}>Signed in as {firstName}</Text> : null}
          {friendCode ? (
            <Text
              style={styles.signedInAs}
              accessibilityLabel={`Your friend code: ${friendCode.replace('-', '').split('').join(' ')}`}
            >
              Friend code: {friendCode}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Account" />
        <View style={styles.card}>
          <SettingRow icon="person-circle-outline" title="Edit profile" onPress={() => go('/profile')} />
          {/* SOS is for PWD accounts; hidden only when known to be non-PWD. */}
          {role !== 'non_pwd' ? (
            <SettingRow divided icon="call-outline" title="Emergency contacts" onPress={() => go('/emergency-contacts')} />
          ) : null}
          <SettingRow divided icon="document-text-outline" title="Terms & Privacy" onPress={() => go('/terms')} />
          <SettingRow
            divided
            action
            danger
            icon="trash-outline"
            title="Delete account"
            description="Schedules your account to be permanently deleted"
            onPress={() => setDeleteOpen(true)}
          />
        </View>

        <View style={[styles.card, styles.signOutCard]}>
          <SettingRow action icon="log-out-outline" title="Sign out" onPress={() => void signOut()} />
        </View>
      </View>

      <DeleteAccountModal
        visible={deleteOpen}
        onCancel={() => setDeleteOpen(false)}
        onScheduled={handleDeletionScheduled}
      />
    </DrawerContentScrollView>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: {
      paddingTop: Spacing.five,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: Spacing.four,
      paddingBottom: Spacing.four,
      marginBottom: Spacing.two,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.border,
    },
    headerText: {
      flex: 1,
    },
    wordmark: {
      fontSize: t.font(16),
      fontWeight: t.weight('800'),
      color: t.colors.textPrimary,
    },
    signedInAs: {
      marginTop: 2,
      fontSize: t.font(13),
      color: t.colors.textSecondary,
    },
    section: {
      paddingHorizontal: Spacing.three,
    },
    card: {
      borderWidth: 1,
      borderColor: t.colors.border,
      borderRadius: 14,
      backgroundColor: t.colors.surface,
      overflow: 'hidden',
    },
    // Set apart from the rest, so it's never tapped by mistake while
    // reaching for something else.
    signOutCard: {
      marginTop: Spacing.four,
    },
  });
