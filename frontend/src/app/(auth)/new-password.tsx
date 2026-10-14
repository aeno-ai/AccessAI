import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { AuthHeader } from '@/components/auth/AuthHeader';
import { AuthInput } from '@/components/auth/AuthInput';
import { FormMessage } from '@/components/auth/FormMessage';
import { PasswordRules } from '@/components/auth/PasswordRules';
import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { KeyboardAvoider } from '@/components/ui/KeyboardAvoider';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { MaxContentWidth } from '@/constants/theme';
import { apiFetch, isApiError } from '@/api/apiClient';
import { useBlockLeaving } from '@/hooks/use-block-leaving';
import { useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { announce } from '@/utils/a11y';
import { passwordOk } from '@/utils/password';

type ResetResponse = { ok?: boolean; verified?: boolean };

const NOT_CHANGED = "Your password wasn't changed. Please try again.";

/**
 * "Forgot password", page 3 of 3: the new password. While it saves, the page
 * can't be left. "Password changed" shows ONLY when the server answers that
 * it saved the new password and read it back from the database (`verified`)
 * — any other answer means it wasn't changed, and says so.
 */
export default function NewPasswordScreen() {
  const styles = useThemedStyles(makeStyles);

  const { email = '', ticket = '' } = useLocalSearchParams<{ email: string; ticket: string }>();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [expired, setExpired] = useState(false);
  const [error, setError] = useState('');

  useBlockLeaving(saving);

  const save = async () => {
    setError('');
    if (!passwordOk(password)) {
      setError('Your new password needs at least 8 characters, 1 capital letter and 1 number.');
      return;
    }
    if (password !== confirmPassword) {
      setError("The two passwords don't match.");
      return;
    }
    setSaving(true);
    try {
      const data = await apiFetch<ResetResponse>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ resetTicket: ticket, password }),
      });
      if (data.ok === true && data.verified === true) {
        setDone(true);
        announce('Password changed. Log in with your new password.');
      } else {
        setError(NOT_CHANGED);
      }
    } catch (e: unknown) {
      if (isApiError(e) && e.body.code === 'RESET_EXPIRED') setExpired(true);
      setError(e instanceof Error ? e.message : NOT_CHANGED);
    } finally {
      setSaving(false);
    }
  };

  const goToLogin = () => router.dismissTo({ pathname: '/login', params: { email } } as unknown as Href);
  const startOver = () => router.dismissTo({ pathname: '/forgot-password', params: { email } } as unknown as Href);

  if (done) {
    return (
      <ScreenShell maxWidth={MaxContentWidth.auth}>
        <ScrollView contentContainerStyle={styles.container}>
          <AuthHeader icon="checkmark-circle-outline" title="Password changed">
            Log in with your new password.
          </AuthHeader>
          <PrimaryButton title="Log in" onPress={goToLogin} />
        </ScrollView>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell maxWidth={MaxContentWidth.auth}>
      <KeyboardAvoider>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <AuthHeader icon="lock-closed-outline" title="Make a new password">
            For <AuthHeader.Bold>{email}</AuthHeader.Bold>
          </AuthHeader>

          <AuthInput
            label="New Password"
            placeholder="Type a new password"
            value={password}
            onChangeText={setPassword}
            isPassword
            editable={!saving && !expired}
            autoComplete="new-password"
            textContentType="newPassword"
            autoFocus
          />
          <PasswordRules password={password} />
          <AuthInput
            label="Confirm New Password"
            placeholder="Type it again"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            isPassword
            editable={!saving && !expired}
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="done"
            onSubmitEditing={() => void save()}
          />

          <FormMessage error={error} />

          {expired ? (
            <PrimaryButton title="Get a new code" onPress={startOver} />
          ) : (
            <PrimaryButton
              title="Save new password"
              loadingTitle="Saving…"
              onPress={() => void save()}
              loading={saving}
              disabled={!password || !confirmPassword}
            />
          )}
        </ScrollView>
      </KeyboardAvoider>
    </ScreenShell>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    container: {
      flexGrow: 1,
      padding: 24,
      justifyContent: 'center',
      backgroundColor: t.colors.background,
    },
  });
