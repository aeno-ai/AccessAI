import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { AuthInput } from '@/components/auth/AuthInput';
import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { KeyboardAvoider } from '@/components/ui/KeyboardAvoider';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { RESEND_CODE_SECONDS } from '@/constants/auth';
import { MaxContentWidth } from '@/constants/theme';
import { apiFetch } from '@/api/apiClient';
import { useBootstrap } from '@/hooks/use-bootstrap';
import { useCountdown } from '@/hooks/use-countdown';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';

type VerifyResponse = {
  token: string;
};

/**
 * Where a new email/password sign-up enters the 6-digit code emailed to it.
 * Reached from Register, or from Login for an account that never finished.
 * The right code logs the user straight in (on into onboarding).
 */
export default function VerifyEmailScreen() {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);

  const { signIn } = useBootstrap();
  // codeSent is '0' when the backend couldn't send the email just now.
  const { email = '', codeSent } = useLocalSearchParams<{ email: string; codeSent?: string }>();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(
    codeSent === '0' ? "We couldn't send the code just now. Tap “Resend code” to try again." : '',
  );
  const [resending, setResending] = useState(false);
  const [resendIn, restartResendTimer] = useCountdown(codeSent === '0' ? 0 : RESEND_CODE_SECONDS);

  const handleVerify = async () => {
    setError('');
    setLoading(true);
    try {
      const data = await apiFetch<VerifyResponse>('/auth/verify-email', {
        method: 'POST',
        body: JSON.stringify({ email, code }),
      });
      await signIn(data.token);
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
      await apiFetch('/auth/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setCode('');
      setNotice('We sent a new code. Only the newest one works.');
      restartResendTimer(RESEND_CODE_SECONDS);
    } catch (e: unknown) {
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
          </View>

          <AuthInput
            label="6-digit code"
            placeholder="123456"
            value={code}
            onChangeText={(text) => setCode(text.replace(/\D/g, ''))}
            keyboardType="number-pad"
            maxLength={6}
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            autoFocus
          />

          {notice ? (
            <Text style={styles.noticeText} accessibilityLiveRegion="polite">
              {notice}
            </Text>
          ) : null}
          {error ? (
            <Text style={styles.errorText} accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}

          <PrimaryButton
            title="Verify email"
            onPress={() => void handleVerify()}
            loading={loading}
            disabled={code.length !== 6}
          />

          <TouchableOpacity
            onPress={() => void handleResend()}
            disabled={resendIn > 0 || resending}
            style={styles.linkWrap}
            accessibilityRole="button"
            accessibilityState={{ disabled: resendIn > 0 || resending }}
          >
            <Text style={[styles.linkAccent, (resendIn > 0 || resending) && styles.linkDisabled]}>
              {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.back()} style={styles.linkWrap} accessibilityRole="button">
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
    bold: {
      fontWeight: t.weight('700'),
      color: t.colors.textPrimary,
    },
    noticeText: {
      color: t.colors.textSecondary,
      textAlign: 'center',
      marginBottom: 12,
    },
    errorText: {
      color: t.colors.dangerText,
      textAlign: 'center',
      marginBottom: 12,
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
    linkDisabled: {
      color: t.colors.textMuted,
    },
  });
