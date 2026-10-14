import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { AuthHeader } from '@/components/auth/AuthHeader';
import { CodeInput } from '@/components/auth/CodeInput';
import { FormMessage } from '@/components/auth/FormMessage';
import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { ResendCodeLink } from '@/components/auth/ResendCodeLink';
import { KeyboardAvoider } from '@/components/ui/KeyboardAvoider';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { MaxContentWidth } from '@/constants/theme';
import { apiFetch } from '@/api/apiClient';
import { useCodeCooldown } from '@/hooks/use-code-cooldown';
import { useCodeDelivery } from '@/hooks/use-code-delivery';
import { useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { goBack } from '@/utils/navigation';

/**
 * "Forgot password", page 2 of 3: the code from the email, on its own. Only
 * a right code opens the new-password page (with a short-lived ticket from
 * the server); this page is replaced, so Back can't return to a used code.
 */
export default function ResetCodeScreen() {
  const styles = useThemedStyles(makeStyles);

  const { email = '' } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  // Shared with page 1, so going back and forth doesn't reset it.
  const cooldown = useCodeCooldown(email, 'reset_password');
  // Did the email really go out? (It's sent in the background.)
  const delivery = useCodeDelivery(email, 'reset_password');
  const { watch } = delivery;
  useEffect(() => {
    watch();
  }, [watch]);

  const checkCode = async () => {
    if (code.length !== 6 || checking) return;
    setError('');
    setNotice('');
    setChecking(true);
    try {
      const data = await apiFetch<{ resetTicket?: string }>('/auth/forgot-password/verify', {
        method: 'POST',
        body: JSON.stringify({ email, code }),
      });
      if (!data.resetTicket) {
        setError("We couldn't check the code. Please try again.");
        setChecking(false);
        return;
      }
      // Stays "Checking…" while this page is replaced.
      router.replace({ pathname: '/new-password', params: { email, ticket: data.resetTicket } } as unknown as Href);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "We couldn't check the code. Please try again.");
      setChecking(false);
    }
  };

  const resend = async () => {
    setError('');
    setNotice('');
    setResending(true);
    try {
      const data = await apiFetch<{ retryAfter?: number }>('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setCode('');
      setNotice('We sent a new code. Only the newest one works.');
      cooldown.start(data.retryAfter ?? 60);
      watch();
    } catch (e: unknown) {
      cooldown.fromError(e);
      setError(e instanceof Error ? e.message : "We couldn't send a new code. Please try again.");
    } finally {
      setResending(false);
    }
  };

  return (
    <ScreenShell maxWidth={MaxContentWidth.auth}>
      <KeyboardAvoider>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <AuthHeader icon="mail-unread-outline" title="Enter the code">
            We sent a 6-digit code to <AuthHeader.Bold>{email}</AuthHeader.Bold>. It works for 10 minutes.
          </AuthHeader>
          <Text style={styles.tip}>Check Spam or Promotions too. It can take a minute.</Text>
          <Text style={styles.googleTip}>
            Signed up with Google? No code is sent for those accounts: they don&apos;t need a password. Go back to login and tap &quot;Continue with Google&quot;.
          </Text>

          <CodeInput value={code} onChange={setCode} editable={!checking} onSubmit={() => void checkCode()} />

          <FormMessage
            error={error || (delivery.failed ? "We couldn't send the email. Tap Resend code." : '')}
            notice={notice}
          />

          <PrimaryButton
            title="Continue"
            loadingTitle="Checking…"
            onPress={() => void checkCode()}
            loading={checking}
            disabled={code.length !== 6}
          />

          <ResendCodeLink
            secondsLeft={cooldown.secondsLeft}
            daily={cooldown.daily}
            busy={resending}
            onPress={() => void resend()}
          />

          <TouchableOpacity onPress={() => goBack('/login')} style={styles.linkWrap} accessibilityRole="button">
            <Text style={styles.linkText}>
              {'Wrong email? '}
              <Text style={styles.linkAccent}>Go back</Text>
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
    tip: {
      color: t.colors.textMuted,
      fontSize: t.font(13),
      textAlign: 'center',
      marginTop: -12,
      marginBottom: 16,
    },
    // Shown to everyone (never only to Google accounts), so it can't tell
    // anyone which emails have an account.
    googleTip: {
      color: t.colors.textSecondary,
      fontSize: t.font(14),
      lineHeight: t.lineHeight(20),
      textAlign: 'center',
      marginBottom: 16,
    },
    linkWrap: {
      marginTop: 8,
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
