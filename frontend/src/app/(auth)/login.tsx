import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { AuthInput } from '@/components/auth/AuthInput';
import { GoogleSignInButton, OrDivider } from '@/components/auth/GoogleSignInButton';
import { PendingDeletionModal } from '@/components/auth/PendingDeletionModal';
import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { AppLogo } from '@/components/onboarding/Illustrations';
import { KeyboardAvoider } from '@/components/ui/KeyboardAvoider';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { MaxContentWidth } from '@/constants/theme';
import { apiFetch, isApiError } from '@/api/apiClient';
import { useBootstrap } from '@/hooks/use-bootstrap';
import { useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';

type LoginResponse = {
  token: string;
};

export default function LoginScreen() {
  const styles = useThemedStyles(makeStyles);

  const { signIn } = useBootstrap();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // Set when the password was right but the account is waiting to be
  // deleted — the backend sends no token then, only this date.
  const [pendingDeletion, setPendingDeletion] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState('');

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const data = await apiFetch<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      await signIn(data.token);
    } catch (e: unknown) {
      if (isApiError(e) && e.body.code === 'ACCOUNT_PENDING_DELETION') {
        setRestoreError('');
        setPendingDeletion(String(e.body.deletionScheduledFor));
      } else if (isApiError(e) && e.body.code === 'EMAIL_NOT_VERIFIED') {
        // Signed up but never entered the emailed code. The backend has just
        // sent a fresh one (unless it sent one in the last minute).
        router.push({
          pathname: '/verify-email',
          params: { email: email.trim(), codeSent: e.body.codeSent === false ? '0' : '1' },
        });
      } else {
        setError(e instanceof Error ? e.message : 'Login failed');
      }
    } finally {
      setLoading(false);
    }
  };

  // Cancels the deletion and logs straight in, reusing the email and
  // password just typed — the backend checks them again.
  const handleRestore = async () => {
    setRestoreError('');
    setRestoring(true);
    try {
      const data = await apiFetch<LoginResponse>('/auth/restore', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setPendingDeletion(null);
      await signIn(data.token);
    } catch (e: unknown) {
      setRestoreError(e instanceof Error ? e.message : 'Could not restore your account');
    } finally {
      setRestoring(false);
    }
  };

  // Leaves the countdown running. Clears the password so the account isn't
  // left one tap away on a shared phone.
  const handleLogOut = () => {
    setPendingDeletion(null);
    setPassword('');
  };

  return (
    <ScreenShell maxWidth={MaxContentWidth.auth}>
      <KeyboardAvoider>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <AppLogo size={72} />
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Log in to continue with PDAccessAI</Text>
          </View>
          <AuthInput
            label="Email Address"
            placeholder="Enter your email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
          />
          <AuthInput
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            isPassword
          />
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/forgot-password', params: { email: email.trim() } })}
            style={styles.forgotWrap}
            accessibilityRole="button"
          >
            <Text style={styles.linkAccent}>Forgot password?</Text>
          </TouchableOpacity>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <PrimaryButton
            title="Login"
            onPress={() => void handleLogin()}
            loading={loading}
            disabled={!email || !password}
          />
          <OrDivider />
          <GoogleSignInButton />
          <TouchableOpacity onPress={() => router.push('/register')} style={styles.linkWrap}>
            <Text style={styles.linkText}>
              {"Don't have an account? "}
              <Text style={styles.linkAccent}>Register</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoider>
      <PendingDeletionModal
        deletionScheduledFor={pendingDeletion}
        restoring={restoring}
        error={restoreError}
        onRestore={() => void handleRestore()}
        onLogOut={handleLogOut}
      />
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
    title: {
      marginTop: 16,
      fontSize: t.font(26),
      fontWeight: t.weight('800'),
      color: t.colors.textPrimary,
      textAlign: 'center',
    },
    subtitle: {
      fontSize: t.font(14),
      color: t.colors.textMuted,
      textAlign: 'center',
      marginTop: 6,
    },
    forgotWrap: {
      alignSelf: 'flex-end',
      minHeight: 44,
      justifyContent: 'center',
      marginTop: -8,
      marginBottom: 8,
    },
    errorText: {
      color: t.colors.dangerText,
      textAlign: 'center',
      marginBottom: 12,
    },
    linkWrap: {
      marginTop: 20,
      alignItems: 'center',
    },
    linkText: {
      color: t.colors.textMuted,
      fontSize: t.font(14),
    },
    linkAccent: {
      color: t.colors.primary,
      fontWeight: t.weight('700'),
    },
  });
