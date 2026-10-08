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
import { useCountdown } from '@/hooks/use-countdown';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';

type Step = 'request' | 'reset' | 'done';

/**
 * "Forgot password", in three steps on one screen: ask for a code, enter it
 * with a new password, then back to Login. Also how an account created with
 * Google adds a password.
 */
export default function ForgotPasswordScreen() {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);

  // Whatever was typed on the login screen, to save typing it again.
  const params = useLocalSearchParams<{ email?: string }>();
  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState(params.email ?? '');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [resendIn, restartResendTimer] = useCountdown();

  const sendCode = async () => {
    setError('');
    setNotice('');
    setLoading(true);
    try {
      await apiFetch('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      if (step === 'reset') {
        setCode('');
        setNotice('We sent a new code. Only the newest one works.');
      }
      setStep('reset');
      restartResendTimer(RESEND_CODE_SECONDS);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not send a code');
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    setError('');
    setNotice('');
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await apiFetch('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, code, password }),
      });
      setStep('done');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not reset your password');
    } finally {
      setLoading(false);
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
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Ionicons
                name={step === 'done' ? 'checkmark-circle-outline' : 'key-outline'}
                size={36}
                color={colors.primary}
              />
            </View>
            <Text style={styles.title} accessibilityRole="header">
              {step === 'done' ? 'Password updated' : 'Reset your password'}
            </Text>
            <Text style={styles.subtitle}>
              {step === 'request'
                ? "Enter your account's email and we'll send you a 6-digit code."
                : step === 'reset'
                  ? `If an account uses ${email}, we sent a 6-digit code to it. It expires in 10 minutes.`
                  : "You've been logged out on all devices. Log in with your new password."}
            </Text>
          </View>

          {step === 'request' ? (
            <AuthInput
              label="Email Address"
              placeholder="Enter your email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoComplete="email"
            />
          ) : null}

          {step === 'reset' ? (
            <>
              <AuthInput
                label="6-digit code"
                placeholder="123456"
                value={code}
                onChangeText={(text) => setCode(text.replace(/\D/g, ''))}
                keyboardType="number-pad"
                maxLength={6}
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
              />
              <AuthInput
                label="New Password"
                placeholder="At least 8 characters, 1 capital, 1 number"
                value={password}
                onChangeText={setPassword}
                isPassword
                textContentType="newPassword"
                autoComplete="new-password"
              />
              <AuthInput
                label="Confirm New Password"
                placeholder="Type it again"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                isPassword
                textContentType="newPassword"
                autoComplete="new-password"
              />
            </>
          ) : null}

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

          {step === 'request' ? (
            <PrimaryButton
              title="Send code"
              onPress={() => void sendCode()}
              loading={loading}
              disabled={!email.trim()}
            />
          ) : null}
          {step === 'reset' ? (
            <PrimaryButton
              title="Reset password"
              onPress={() => void resetPassword()}
              loading={loading}
              disabled={code.length !== 6 || !password || !confirmPassword}
            />
          ) : null}
          {step === 'done' ? <PrimaryButton title="Back to login" onPress={backToLogin} /> : null}

          {step === 'reset' ? (
            <>
              <TouchableOpacity
                onPress={() => void sendCode()}
                disabled={resendIn > 0 || loading}
                style={styles.linkWrap}
                accessibilityRole="button"
                accessibilityState={{ disabled: resendIn > 0 || loading }}
              >
                <Text style={[styles.linkAccent, (resendIn > 0 || loading) && styles.linkDisabled]}>
                  {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setError('');
                  setNotice('');
                  setStep('request');
                }}
                style={styles.linkWrap}
                accessibilityRole="button"
              >
                <Text style={styles.linkText}>
                  {'Wrong email? '}
                  <Text style={styles.linkAccent}>Change it</Text>
                </Text>
              </TouchableOpacity>
            </>
          ) : null}

          {step === 'request' ? (
            <TouchableOpacity onPress={backToLogin} style={styles.linkWrap} accessibilityRole="button">
              <Text style={styles.linkText}>
                {'Remembered it? '}
                <Text style={styles.linkAccent}>Back to login</Text>
              </Text>
            </TouchableOpacity>
          ) : null}
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
