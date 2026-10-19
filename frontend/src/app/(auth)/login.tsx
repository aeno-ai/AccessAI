import { useState } from 'react';
import {
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
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
import { startCodeCooldown } from '@/hooks/use-code-cooldown';

type LoginResponse = {
  token: string;
};

export default function LoginScreen() {
  const styles = useThemedStyles(makeStyles);

  // signOutNotice: why the app was just signed out (an admin paused the
  // account, or is deleting it).
  const { signIn, signOutNotice } = useBootstrap();
  // Set when coming back from "Forgot password", so only the new password
  // needs typing.
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [password, setPassword] = useState('');
  // A new email handed over while this screen was already open (it stays
  // mounted under "Forgot password"): show it, with the password cleared.
  const [handedEmail, setHandedEmail] = useState(params.email);
  if (params.email && params.email !== handedEmail) {
    setHandedEmail(params.email);
    setEmail(params.email);
    setPassword('');
  }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // The email or password was wrong: "Forgot password?" goes right under it.
  const [wrongLogin, setWrongLogin] = useState(false);
  // Set when the password was right but the account is waiting to be
  // deleted — the backend sends no token then, only this date.
  const [pendingDeletion, setPendingDeletion] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState('');

  const handleLogin = async () => {
    // So the screen doesn't jump under the finger as the keyboard closes.
    Keyboard.dismiss();
    setError('');
    setWrongLogin(false);
    setLoading(true);
    try {
      const data = await apiFetch<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      // Stays "Logging in…" until the app moves on — clearing it here would
      // flash the Login button back for a moment.
      await signIn(data.token);
    } catch (e: unknown) {
      setLoading(false);
      if (isApiError(e) && e.body.code === 'ACCOUNT_PENDING_DELETION') {
        setRestoreError('');
        setPendingDeletion(String(e.body.deletionScheduledFor));
      } else if (isApiError(e) && e.body.code === 'EMAIL_NOT_VERIFIED') {
        // Signed up but never entered the emailed code. The backend has just
        // sent a fresh one (unless it sent one in the last minute).
        startCodeCooldown(email.trim(), 'verify_email', e.body.retryAfter, Number(e.body.retryAfter) > 60);
        router.push({
          pathname: '/verify-email',
          params: { email: email.trim(), codeSent: e.body.codeSent === false ? '0' : '1' },
        });
      } else {
        setWrongLogin(isApiError(e) && e.status === 401);
        setError(e instanceof Error ? e.message : 'Login failed');
      }
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
            <Text style={styles.subtitle}>Log in to continue with AccessAI</Text>
          </View>
          {signOutNotice ? (
            <View style={styles.notice} accessibilityRole="alert" accessibilityLiveRegion="polite">
              <Text style={styles.noticeText}>{signOutNotice}</Text>
            </View>
          ) : null}
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
          {error ? (
            <Text style={styles.errorText} accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}
          {wrongLogin ? (
            <TouchableOpacity
              onPress={() => router.push({ pathname: '/forgot-password', params: { email: email.trim() } })}
              style={styles.errorLink}
              accessibilityRole="button"
            >
              <Text style={styles.linkAccent}>Forgot password? Set a new one</Text>
            </TouchableOpacity>
          ) : null}
          <PrimaryButton
            title="Login"
            loadingTitle="Logging in…"
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
    notice: {
      borderWidth: 1,
      borderColor: t.colors.dangerText,
      borderRadius: 12,
      padding: 14,
      marginBottom: 20,
    },
    noticeText: {
      color: t.colors.dangerText,
      fontSize: t.font(15),
      fontWeight: t.weight('600'),
      textAlign: 'center',
    },
    errorText: {
      color: t.colors.dangerText,
      textAlign: 'center',
      marginBottom: 12,
    },
    errorLink: {
      alignSelf: 'center',
      minHeight: 44,
      justifyContent: 'center',
      marginTop: -8,
      marginBottom: 8,
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
