import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { PendingDeletionModal } from '@/components/auth/PendingDeletionModal';
import { apiFetch, apiUrl, isApiError } from '@/api/apiClient';
import { GOOGLE_REDIRECT_PATH } from '@/constants/auth';

import { useBootstrap } from '@/hooks/use-bootstrap';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';

type ExchangeResponse =
  | { token: string }
  | {
      needsSignup: true;
      signupTicket: string;
      profile: { email: string; firstName: string; lastName: string };
    };

type RestoreResponse = {
  token: string;
};

const firstString = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * "Continue with Google", for both login and sign-up. The backend runs the
 * whole Google sign-in (backend/src/controllers/googleAuthController.js):
 * this opens it in the browser, waits for the link back into the app, and
 * trades the ticket on that link for a login token. Someone new is sent to
 * the finish-sign-up screen instead, for the account type and consent that
 * Google can't give us.
 */
export function GoogleSignInButton() {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);

  const { signIn } = useBootstrap();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Set when the Google account's AccessAI account is waiting to be
  // deleted — same prompt as a password login gets.
  const [pendingDeletion, setPendingDeletion] = useState<string | null>(null);
  const [restoreTicket, setRestoreTicket] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState('');

  const handlePress = async () => {
    setError('');
    setLoading(true);
    try {
      const redirectUrl = Linking.createURL(GOOGLE_REDIRECT_PATH);
      const result = await WebBrowser.openAuthSessionAsync(
        apiUrl(`/auth/google/start?redirect=${encodeURIComponent(redirectUrl)}`),
        redirectUrl,
      );
      // Browser closed without finishing — nothing to report.
      if (result.type !== 'success') {
        return;
      }

      const params = Linking.parse(result.url).queryParams ?? {};
      const ticket = firstString(params.ticket);
      if (!ticket) {
        if (!params.cancelled) {
          setError(firstString(params.error) ?? 'Google sign-in failed. Please try again.');
        }
        return;
      }

      const data = await apiFetch<ExchangeResponse>('/auth/google/exchange', {
        method: 'POST',
        body: JSON.stringify({ ticket }),
      });
      if ('token' in data) {
        await signIn(data.token);
        return;
      }
      router.push({
        pathname: '/google-signup',
        params: { signupTicket: data.signupTicket, ...data.profile },
      });
    } catch (e: unknown) {
      if (isApiError(e) && e.body.code === 'ACCOUNT_PENDING_DELETION') {
        setRestoreError('');
        setRestoreTicket(String(e.body.restoreTicket));
        setPendingDeletion(String(e.body.deletionScheduledFor));
      } else {
        setError(e instanceof Error ? e.message : 'Google sign-in failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    setRestoreError('');
    setRestoring(true);
    try {
      const data = await apiFetch<RestoreResponse>('/auth/google/restore', {
        method: 'POST',
        body: JSON.stringify({ restoreTicket }),
      });
      setPendingDeletion(null);
      await signIn(data.token);
    } catch (e: unknown) {
      setRestoreError(e instanceof Error ? e.message : 'Could not restore your account');
    } finally {
      setRestoring(false);
    }
  };

  // Leaves the countdown running, and forgets the ticket that could have
  // restored the account.
  const handleLogOut = () => {
    setPendingDeletion(null);
    setRestoreTicket(null);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, loading && styles.busy]}
        onPress={() => void handlePress()}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel="Continue with Google"
        accessibilityState={{ disabled: loading, busy: loading }}
      >
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <>
            <Ionicons name="logo-google" size={20} color={colors.textPrimary} />
            <Text style={styles.text}>Continue with Google</Text>
          </>
        )}
      </TouchableOpacity>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <PendingDeletionModal
        deletionScheduledFor={pendingDeletion}
        restoring={restoring}
        error={restoreError}
        onRestore={() => void handleRestore()}
        onLogOut={handleLogOut}
      />
    </View>
  );
}

/** A thin rule with a word in the middle, between two ways of signing in. */
export function OrDivider({ label = 'or' }: { label?: string }) {
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.dividerRow} accessible={false} importantForAccessibility="no-hide-descendants">
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>{label}</Text>
      <View style={styles.dividerLine} />
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: {
      width: '100%',
    },
    button: {
      flexDirection: 'row',
      gap: 10,
      height: 52,
      width: '100%',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.colors.inputBorder,
      backgroundColor: t.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    busy: {
      opacity: 0.7,
    },
    text: {
      color: t.colors.textPrimary,
      fontWeight: t.weight('700'),
      fontSize: t.font(16),
    },
    errorText: {
      color: t.colors.dangerText,
      textAlign: 'center',
      marginTop: 10,
    },
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 20,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: t.colors.border,
    },
    dividerText: {
      marginHorizontal: 12,
      color: t.colors.textMuted,
      fontSize: t.font(13),
    },
  });
