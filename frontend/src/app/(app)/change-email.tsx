import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { apiFetch } from '@/api/apiClient';
import { AuthHeader } from '@/components/auth/AuthHeader';
import { AuthInput } from '@/components/auth/AuthInput';
import { CodeInput } from '@/components/auth/CodeInput';
import { FormMessage } from '@/components/auth/FormMessage';
import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { ResendCodeLink } from '@/components/auth/ResendCodeLink';
import { KeyboardAvoider } from '@/components/ui/KeyboardAvoider';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { useBlockLeaving } from '@/hooks/use-block-leaving';
import { useCodeCooldown } from '@/hooks/use-code-cooldown';
import { useIsOnline } from '@/hooks/use-is-online';
import { announce } from '@/utils/a11y';
import { goBack } from '@/utils/navigation';

type MeResponse = { user: { email: string; hasPassword?: boolean } };
type ChangeResponse = { ok?: boolean; verified?: boolean; email?: string };
type Step = 'enter' | 'code' | 'done';

const NOT_CHANGED = "Your email wasn't changed. Please try again.";

/**
 * "Change email", from Edit profile: the new address (and the password, if
 * the account has one), then the code sent to that NEW address — proof it's
 * theirs. "Email changed" shows only once the server has saved it and read
 * it back (`verified`). Codes for "Forgot password" then go to the new one.
 */
export default function ChangeEmailScreen() {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const online = useIsOnline();

  const [account, setAccount] = useState<MeResponse['user'] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [step, setStep] = useState<Step>('enter');
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  // Per new address: the code goes there.
  const cooldown = useCodeCooldown(newEmail, 'change_email');

  useBlockLeaving(busy && step === 'code');

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setAccount(null);
      setLoadError('');
      setStep('enter');
      setNewEmail('');
      setPassword('');
      setCode('');
      setError('');
      setNotice('');
      apiFetch<MeResponse>('/auth/me')
        .then(({ user }) => !cancelled && setAccount(user))
        .catch(() => !cancelled && setLoadError('Connect to the internet to change your email.'));
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const hasPassword = account?.hasPassword !== false;

  const sendCode = async () => {
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const data = await apiFetch<{ retryAfter?: number }>('/auth/me/email-code', {
        method: 'POST',
        body: JSON.stringify(hasPassword ? { newEmail: newEmail.trim(), password } : { newEmail: newEmail.trim() }),
      });
      if (step === 'code') {
        setCode('');
        setNotice('We sent a new code. Only the newest one works.');
      }
      setStep('code');
      cooldown.start(data.retryAfter ?? 60);
    } catch (e: unknown) {
      cooldown.fromError(e);
      setError(e instanceof Error ? e.message : "We couldn't send a code. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (code.length !== 6 || busy) return;
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const data = await apiFetch<ChangeResponse>('/auth/me/email', {
        method: 'POST',
        body: JSON.stringify({ code }),
      });
      if (data.ok === true && data.verified === true) {
        setNewEmail(data.email ?? newEmail.trim());
        setStep('done');
        announce('Email changed.');
      } else {
        setError(NOT_CHANGED);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : NOT_CHANGED);
    } finally {
      setBusy(false);
    }
  };

  const canSend = online && Boolean(newEmail.trim()) && (!hasPassword || Boolean(password)) && !busy;

  return (
    <ScreenShell maxWidth={MaxContentWidth.app}>
      <KeyboardAvoider>
        <ScreenHeader title="Change email" backDisabled={busy && step === 'code'} />

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {account === null && !loadError ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : null}
          {loadError ? <Text style={styles.notice}>{loadError}</Text> : null}

          {account && step === 'enter' ? (
            <>
              <Text style={styles.explain}>
                Your email now: <Text style={styles.bold}>{account.email}</Text>
              </Text>
              <AuthInput
                label="New email"
                placeholder="Type your new email"
                value={newEmail}
                onChangeText={setNewEmail}
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
                editable={!busy}
              />
              {hasPassword ? (
                <AuthInput
                  label="Your password"
                  placeholder="To check it's you"
                  value={password}
                  onChangeText={setPassword}
                  isPassword
                  editable={!busy}
                  autoComplete="current-password"
                  textContentType="password"
                />
              ) : null}
              {!online ? <Text style={styles.notice}>Connect to the internet to change your email.</Text> : null}
              <FormMessage error={error} />
              <PrimaryButton title="Send code" loadingTitle="Sending…" onPress={() => void sendCode()} loading={busy} disabled={!canSend} />
            </>
          ) : null}

          {account && step === 'code' ? (
            <>
              <AuthHeader icon="mail-unread-outline" title="Enter the code">
                We sent a 6-digit code to <AuthHeader.Bold>{newEmail.trim()}</AuthHeader.Bold>.
              </AuthHeader>
              <CodeInput value={code} onChange={setCode} editable={!busy} onSubmit={() => void confirm()} />
              <FormMessage error={error} notice={notice} />
              <PrimaryButton title="Confirm" loadingTitle="Checking…" onPress={() => void confirm()} loading={busy} disabled={code.length !== 6} />
              <ResendCodeLink secondsLeft={cooldown.secondsLeft} daily={cooldown.daily} busy={busy} onPress={() => void sendCode()} />
            </>
          ) : null}

          {step === 'done' ? (
            <>
              <AuthHeader icon="checkmark-circle-outline" title="Email changed">
                From now on, log in with <AuthHeader.Bold>{newEmail}</AuthHeader.Bold>.
              </AuthHeader>
              <PrimaryButton title="Done" onPress={() => goBack()} />
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
    explain: {
      fontSize: t.font(15),
      lineHeight: t.lineHeight(21),
      color: t.colors.textSecondary,
      marginBottom: Spacing.three,
    },
    bold: {
      fontWeight: t.weight('700'),
      color: t.colors.textPrimary,
    },
    notice: {
      marginBottom: Spacing.three,
      fontSize: t.font(14),
      lineHeight: t.lineHeight(20),
      color: t.colors.textSecondary,
      textAlign: 'center',
    },
  });
