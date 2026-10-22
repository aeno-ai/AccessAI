import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { router, useFocusEffect, type Href } from 'expo-router';
import { apiFetch } from '@/api/apiClient';
import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { MaxContentWidth } from '@/constants/theme';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { useBootstrap } from '@/hooks/use-bootstrap';
import { announce } from '@/utils/a11y';

type MeResponse = { user: { hasPassword?: boolean; google?: boolean } };

/**
 * "Secure my account" (HANDOFF §56): opened from the "signed in on another
 * phone" notification, or Edit profile. Signs out every other phone, and —
 * for password accounts — leads to Change password (which signs them out too).
 */
export default function SecureAccountScreen() {
  const { signIn } = useBootstrap();
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const [account, setAccount] = useState<MeResponse['user'] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setMessage('');
      apiFetch<MeResponse>('/auth/me')
        .then(({ user }) => !cancelled && setAccount(user))
        .catch(() => !cancelled && setMessage('Connect to the internet to secure your account.'));
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const googleOnly = account?.google === true || account?.hasPassword === false;

  const signOutOthers = async () => {
    setBusy(true);
    setMessage('');
    try {
      const data = await apiFetch<{ token: string }>('/auth/me/sign-out-others', { method: 'POST' });
      await signIn(data.token);
      setMessage('Done. Every other phone is signed out.');
      announce('Every other phone is signed out.');
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "That didn't work. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenShell maxWidth={MaxContentWidth.app}>
      <ScreenHeader title="Secure my account" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title} accessibilityRole="header">
          Was it you?
        </Text>
        <Text style={styles.text}>
          Someone signed in to your AccessAI account on another phone. If it was you, there&apos;s nothing to do.
        </Text>
        <Pressable style={styles.secondary} onPress={() => router.back()} accessibilityRole="button">
          <Text style={styles.secondaryText}>Yes, it was me</Text>
        </Pressable>

        <Text style={[styles.title, styles.spaced]} accessibilityRole="header">
          It wasn&apos;t me
        </Text>
        {account === null && !message ? <ActivityIndicator color={colors.primary} /> : null}
        {account ? (
          <>
            <PrimaryButton
              title="Sign out all other phones"
              loadingTitle="Signing out…"
              loading={busy}
              onPress={() => void signOutOthers()}
              accessibilityHint="Only this phone stays signed in"
            />
            {googleOnly ? (
              <Text style={styles.text}>
                You sign in with Google, so also check your Google account&apos;s security (Google Account → Security).
              </Text>
            ) : (
              <>
                <Text style={styles.text}>Then change your password, so whoever it was can&apos;t sign in again.</Text>
                <Pressable style={styles.secondary} onPress={() => router.push('/change-password' as Href)} accessibilityRole="button">
                  <Text style={styles.secondaryText}>Change my password</Text>
                </Pressable>
              </>
            )}
          </>
        ) : null}
        {message ? (
          <Text style={styles.message} accessibilityLiveRegion="polite">
            {message}
          </Text>
        ) : null}
      </ScrollView>
    </ScreenShell>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    content: {
      gap: 12,
      padding: 16,
      paddingBottom: 40,
    },
    title: {
      fontSize: t.font(20),
      fontWeight: t.weight('800'),
      color: t.colors.textPrimary,
    },
    spaced: {
      marginTop: 12,
    },
    text: {
      fontSize: t.font(16),
      lineHeight: t.lineHeight(23),
      color: t.colors.textSecondary,
    },
    secondary: {
      minHeight: 48,
      paddingHorizontal: 16,
      borderRadius: 24,
      borderWidth: 1.5,
      borderColor: t.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    secondaryText: {
      fontSize: t.font(16),
      fontWeight: t.weight('700'),
      color: t.colors.primary,
    },
    message: {
      fontSize: t.font(16),
      fontWeight: t.weight('700'),
      color: t.colors.textPrimary,
    },
  });
