import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams, type Href } from 'expo-router';
import { AuthHeader } from '@/components/auth/AuthHeader';
import { AuthInput } from '@/components/auth/AuthInput';
import { FormMessage } from '@/components/auth/FormMessage';
import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { KeyboardAvoider } from '@/components/ui/KeyboardAvoider';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { MaxContentWidth } from '@/constants/theme';
import { apiFetch } from '@/api/apiClient';
import { useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { cooldownLabel, useCodeCooldown } from '@/hooks/use-code-cooldown';

/**
 * "Forgot password", page 1 of 3: the account's email. The server sends the
 * code only to the email registered on that account (never anywhere else),
 * then the code page (reset-code.tsx) and the new-password page
 * (new-password.tsx) follow. An account created with Google gets no code:
 * it stays Google-only. The answer is the same for every email, so the tip
 * for Google sign-ups is shown to everyone.
 */
export default function ForgotPasswordScreen() {
  const styles = useThemedStyles(makeStyles);

  // Whatever was typed on the login screen, to save typing it again.
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // The same wait as the code page's "Resend code": going back and asking
  // again can't send another code early (or fake that one was sent).
  const cooldown = useCodeCooldown(email, 'reset_password');
  const waiting = cooldown.secondsLeft > 0;

  // Back from the code page: the button is ready again.
  useFocusEffect(useCallback(() => setLoading(false), []));

  const openCodePage = (address: string) =>
    router.push({ pathname: '/reset-code', params: { email: address } } as unknown as Href);

  const sendCode = async () => {
    const address = email.trim();
    setError('');
    setLoading(true);
    try {
      const data = await apiFetch<{ retryAfter?: number }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: address }),
      });
      cooldown.start(data.retryAfter ?? 60);
      // Stays "Sending…" while the code page opens.
      openCodePage(address);
    } catch (e: unknown) {
      setLoading(false);
      cooldown.fromError(e);
      setError(e instanceof Error ? e.message : "We couldn't send a code. Please try again.");
    }
  };

  const backToLogin = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/login');
    }
  };

  return (
    <ScreenShell maxWidth={MaxContentWidth.auth}>
      <KeyboardAvoider>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <AuthHeader icon="key-outline" title="Forgot your password?">
            Enter your email and we&apos;ll send you a 6-digit code.
          </AuthHeader>

          <AuthInput
            label="Email Address"
            placeholder="Enter your email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="send"
            onSubmitEditing={() => email.trim() && void sendCode()}
          />

          <FormMessage error={error} />

          <PrimaryButton
            title={waiting ? cooldownLabel(cooldown.secondsLeft, cooldown.daily) : 'Send code'}
            loadingTitle="Sending…"
            onPress={() => void sendCode()}
            loading={loading}
            disabled={!email.trim() || waiting}
          />

          {waiting ? (
            // A code already went out: it works for 10 minutes.
            <TouchableOpacity onPress={() => openCodePage(email.trim())} style={styles.linkWrap} accessibilityRole="button">
              <Text style={styles.linkAccent}>I already have a code</Text>
            </TouchableOpacity>
          ) : null}

          <Text style={styles.googleTip}>
            Signed up with Google? You don&apos;t need a password. Go back to login and tap &quot;Continue with Google&quot;.
          </Text>

          <TouchableOpacity onPress={backToLogin} style={styles.linkWrap} accessibilityRole="button">
            <Text style={styles.linkText}>
              {'Remembered it? '}
              <Text style={styles.linkAccent}>Back to login</Text>
            </Text>
          </TouchableOpacity>
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
    },
    // Shown to everyone (never only to Google accounts), so it can't tell
    // anyone which emails have an account.
    googleTip: {
      color: t.colors.textSecondary,
      fontSize: t.font(14),
      lineHeight: t.lineHeight(20),
      textAlign: 'center',
      marginTop: 16,
    },
    linkWrap: {
      marginTop: 20,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    linkText: {
      color: t.colors.textMuted,
      fontSize: t.font(14),
    },
    linkAccent: {
      color: t.colors.primary,
      fontWeight: t.weight('700'),
      fontSize: t.font(14),
    },
  });
