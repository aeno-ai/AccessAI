import { useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { CodeInput } from '@/components/auth/CodeInput';
import { FormMessage } from '@/components/auth/FormMessage';
import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { ResendCodeLink } from '@/components/auth/ResendCodeLink';
import { KeyboardAvoider } from '@/components/ui/KeyboardAvoider';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { MaxContentWidth } from '@/constants/theme';
import { apiFetch } from '@/api/apiClient';
import { useBlockLeaving } from '@/hooks/use-block-leaving';
import { useBootstrap } from '@/hooks/use-bootstrap';
import { useCodeCooldown } from '@/hooks/use-code-cooldown';
import { useCodeDelivery } from '@/hooks/use-code-delivery';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { goBack } from '@/utils/navigation';

type VerifyResponse = {
  token: string;
};

/**
 * Where a new email/password sign-up enters the 6-digit code emailed to it.
 * Reached from Register, or from Login for an account that never finished.
 * The right code logs the user straight in (on into onboarding): the button
 * says "Verified. Setting up…" and Back is blocked until the app moves on.
 */
export default function VerifyEmailScreen() {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);

  const { signIn, hasOnboarded } = useBootstrap();
  const onboardedRef = useRef(hasOnboarded);
  useEffect(() => {
    onboardedRef.current = hasOnboarded;
  });
  // codeSent is '0' when no new code was sent just now (one went out a
  // moment ago — the wait is already counting down).
  const { email = '', codeSent } = useLocalSearchParams<{ email: string; codeSent?: string }>();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  // The code was right: setting up, and going back would land on Register.
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(
    codeSent === '0' ? 'We sent you a code a moment ago. Check your email.' : '',
  );
  const [resending, setResending] = useState(false);
  // Started by Register / Login with the server's wait; shared with them.
  const cooldown = useCodeCooldown(email, 'verify_email');
  // Did the email really go out? (It's sent in the background.)
  const delivery = useCodeDelivery(email, 'verify_email');
  const { watch } = delivery;
  useEffect(() => {
    if (codeSent !== '0') watch();
  }, [codeSent, watch]);

  useBlockLeaving(verified);

  // Normally the app moves on by itself once signed in. If it hasn't after
  // 1.5 s (a slow development build), go there directly.
  useEffect(() => {
    if (!verified) return;
    const timer = setTimeout(() => router.replace(onboardedRef.current ? '/' : '/onboarding'), 1500);
    return () => clearTimeout(timer);
  }, [verified]);

  const handleVerify = async () => {
    setError('');
    setLoading(true);
    try {
      const data = await apiFetch<VerifyResponse>('/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ email, code }),
      });
      setVerified(true);
      // A brand-new account: onboarding, with its own preferences.
      await signIn(data.token, { isNew: true });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not verify your email');
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setNotice('');
    setResending(true);
    try {
      const data = await apiFetch<{ retryAfter?: number }>('/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setCode('');
      setNotice('We sent a new code. Only the newest one works.');
      cooldown.start(data.retryAfter ?? 60);
      watch();
    } catch (e: unknown) {
      cooldown.fromError(e);
      setError(e instanceof Error ? e.message : 'Could not send a new code');
    } finally {
      setResending(false);
    }
  };

  return (
    <ScreenShell maxWidth={MaxContentWidth.auth}>
      <KeyboardAvoider>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Ionicons name="mail-unread-outline" size={36} color={colors.primary} />
            </View>
            <Text style={styles.title} accessibilityRole="header">
              Check your email
            </Text>
            <Text style={styles.subtitle}>
              We sent a 6-digit code to <Text style={styles.bold}>{email}</Text>. It expires in 10 minutes.
            </Text>
            <Text style={styles.tip}>Check Spam or Promotions too. It can take a minute.</Text>
          </View>

          <CodeInput value={code} onChange={setCode} onSubmit={() => code.length === 6 && void handleVerify()} />

          <FormMessage
            error={error || (delivery.failed && !verified ? "We couldn't send the email. Tap Resend code." : '')}
            notice={notice}
          />

          <PrimaryButton
            title="Verify email"
            loadingTitle={verified ? 'Verified. Setting up…' : 'Checking…'}
            onPress={() => void handleVerify()}
            loading={loading}
            disabled={code.length !== 6}
          />

          {verified ? null : (
            <>
              <ResendCodeLink
                secondsLeft={cooldown.secondsLeft}
                daily={cooldown.daily}
                busy={resending}
                onPress={() => void handleResend()}
              />

              <TouchableOpacity onPress={() => goBack('/login')} style={styles.linkWrap} accessibilityRole="button">
                <Text style={styles.linkText}>
                  {'Wrong email? '}
                  <Text style={styles.linkAccent}>Go back</Text>
                </Text>
              </TouchableOpacity>
            </>
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
    },
    header: {
      alignItems: 'center',
      marginBottom: 28,
    },
    iconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: t.colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      marginTop: 16,
      fontSize: t.font(26),
      fontWeight: t.weight('800'),
      color: t.colors.textPrimary,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: t.font(14),
      lineHeight: t.lineHeight(20),
      color: t.colors.textMuted,
      textAlign: 'center',
      marginTop: 6,
    },
    tip: {
      fontSize: t.font(13),
      color: t.colors.textMuted,
      textAlign: 'center',
      marginTop: 8,
    },
    bold: {
      fontWeight: t.weight('700'),
      color: t.colors.textPrimary,
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
