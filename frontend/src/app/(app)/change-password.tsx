import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { apiFetch } from '@/api/apiClient';
import { AuthHeader } from '@/components/auth/AuthHeader';
import { AuthInput } from '@/components/auth/AuthInput';
import { FormMessage } from '@/components/auth/FormMessage';
import { PasswordRules } from '@/components/auth/PasswordRules';
import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { KeyboardAvoider } from '@/components/ui/KeyboardAvoider';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { useBlockLeaving } from '@/hooks/use-block-leaving';
import { useBootstrap } from '@/hooks/use-bootstrap';
import { useIsOnline } from '@/hooks/use-is-online';
import { announce } from '@/utils/a11y';
import { passwordOk } from '@/utils/password';
import { goBack } from '@/utils/navigation';

type MeResponse = { user: { email: string; hasPassword?: boolean; google?: boolean } };
type ChangeResponse = { ok?: boolean; verified?: boolean; token?: string };

const NOT_CHANGED = "Your password wasn't changed. Please try again.";

/**
 * "Change password", from Edit profile. Needs the current password.
 * "Password changed" shows only once the server has saved the new password
 * and read it back (`verified`). Other phones are signed out; this one stays
 * signed in with the fresh token. An account made with Google has no
 * password and can't add one: it keeps signing in with Google.
 */
export default function ChangePasswordScreen() {
  const { signIn } = useBootstrap();
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const online = useIsOnline();

  const [account, setAccount] = useState<MeResponse['user'] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  useBlockLeaving(saving);

  // A fresh start on every visit — drawer screens stay mounted.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setAccount(null);
      setLoadError('');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setDone(false);
      setError('');
      apiFetch<MeResponse>('/auth/me')
        .then(({ user }) => !cancelled && setAccount(user))
        .catch(() => !cancelled && setLoadError('Connect to the internet to change your password.'));
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const googleOnly = account?.hasPassword === false || account?.google === true;

  const save = async () => {
    setError('');
    if (!passwordOk(newPassword)) {
      setError('Your new password needs at least 8 characters, 1 capital letter and 1 number.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The two new passwords don't match.");
      return;
    }
    setSaving(true);
    try {
      const data = await apiFetch<ChangeResponse>('/auth/me/password', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (data.ok === true && data.verified === true && data.token) {
        await signIn(data.token);
        setDone(true);
        announce('Password changed.');
      } else {
        setError(NOT_CHANGED);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : NOT_CHANGED);
    } finally {
      setSaving(false);
    }
  };

  const canSave = online && Boolean(currentPassword) && Boolean(newPassword) && Boolean(confirmPassword) && !saving;

  return (
    <ScreenShell maxWidth={MaxContentWidth.app}>
      <KeyboardAvoider>
        <ScreenHeader title="Password" backDisabled={saving} />

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {account === null && !loadError ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : null}
          {loadError ? <Text style={styles.notice}>{loadError}</Text> : null}

          {done ? (
            <>
              <AuthHeader icon="checkmark-circle-outline" title="Password changed">
                Use your new password next time you log in. Your other devices were signed out.
              </AuthHeader>
              <PrimaryButton title="Done" onPress={() => goBack()} />
            </>
          ) : googleOnly ? (
            <>
              <AuthHeader icon="logo-google" title="You sign in with Google">
                Your account was made with Google, so it has no password. Keep using &quot;Continue with Google&quot; to log in.
              </AuthHeader>
              <PrimaryButton title="Done" onPress={() => goBack()} />
            </>
          ) : account ? (
            <>
              <AuthInput
                label="Current password"
                placeholder="Your password now"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                isPassword
                editable={!saving}
                autoComplete="current-password"
                textContentType="password"
              />
              <AuthInput
                label="New password"
                placeholder="Type a new password"
                value={newPassword}
                onChangeText={setNewPassword}
                isPassword
                editable={!saving}
                autoComplete="new-password"
                textContentType="newPassword"
              />
              <PasswordRules password={newPassword} />
              <AuthInput
                label="Confirm new password"
                placeholder="Type it again"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                isPassword
                editable={!saving}
                autoComplete="new-password"
                textContentType="newPassword"
              />

              {!online ? <Text style={styles.notice}>Connect to the internet to change your password.</Text> : null}
              <FormMessage error={error} />

              <PrimaryButton title="Save new password" loadingTitle="Saving…" onPress={() => void save()} loading={saving} disabled={!canSave} />
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoider>
    </ScreenShell>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    content: {
      padding: Spacing.four,
      paddingBottom: Spacing.six,
    },
    loader: {
      marginTop: Spacing.five,
    },
    notice: {
      marginBottom: Spacing.three,
      fontSize: t.font(14),
      lineHeight: t.lineHeight(20),
      color: t.colors.textSecondary,
      textAlign: 'center',
    },
  });
