import { useCallback, useState } from 'react';
import {
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { AuthInput } from '@/components/auth/AuthInput';
import { GoogleSignInButton, OrDivider } from '@/components/auth/GoogleSignInButton';
import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { RoleSelector } from '@/components/auth/RoleSelector';
import { TermsConsent } from '@/components/auth/TermsConsent';
import { AppLogo } from '@/components/onboarding/Illustrations';
import { KeyboardAvoider } from '@/components/ui/KeyboardAvoider';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { MaxContentWidth } from '@/constants/theme';
import { apiFetch, isApiError } from '@/api/apiClient';
import type { UserRole } from '@/hooks/use-bootstrap';
import { useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { startCodeCooldown } from '@/hooks/use-code-cooldown';

type RegisterResponse = {
  // false if no new code was sent just now (one went out a moment ago).
  codeSent: boolean;
  /** Seconds before another code can be asked for. */
  retryAfter?: number;
};

export default function RegisterScreen() {
  const styles = useThemedStyles(makeStyles);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  // No default: choosing PWD comes with a declaration, so nobody should end
  // up registered as one just because it was preselected.
  const [role, setRole] = useState<UserRole | null>(null);
  const [pwdDeclared, setPwdDeclared] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // The email already has an account: offer Log in (and say if it's a Google one).
  const [emailInUse, setEmailInUse] = useState<{ google: boolean } | null>(null);

  // Back from the code page: the button is ready again.
  useFocusEffect(useCallback(() => setLoading(false), []));

  const consentGiven = acceptedTerms && (role !== 'pwd' || pwdDeclared);

  const handleRegister = async () => {
    setError('');
    setEmailInUse(null);
    if (!role || !consentGiven) {
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    Keyboard.dismiss();
    setLoading(true);
    try {
      const data = await apiFetch<RegisterResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email,
          password,
          role,
          // The backend refuses the sign-up unless these are exactly true,
          // and records when they were agreed to.
          acceptedTerms,
          pwdDeclaration: role === 'pwd' && pwdDeclared,
        }),
      });
      // The account can't be used until the emailed code is entered. That
      // screen logs the new user straight in, on into onboarding — no
      // second password entry needed. (The button stays busy until then;
      // coming back here makes it ready again.)
      // More than a minute means "too many today".
      startCodeCooldown(email.trim(), 'verify_email', data.retryAfter, Number(data.retryAfter) > 60);
      router.push({
        pathname: '/verify-email',
        params: { email: email.trim(), codeSent: data.codeSent ? '1' : '0' },
      });
    } catch (e: unknown) {
      setLoading(false);
      if (isApiError(e) && e.body.code === 'EMAIL_IN_USE') {
        setEmailInUse({ google: e.body.google === true });
        return;
      }
      setError(e instanceof Error ? e.message : 'Registration failed');
    }
  };

  return (
    <ScreenShell maxWidth={MaxContentWidth.auth}>
      <KeyboardAvoider>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <AppLogo size={64} />
            <Text style={styles.title}>Create account</Text>
            <Text style={styles.subtitle}>Sign up to get started</Text>
          </View>

          <GoogleSignInButton />
          <OrDivider label="or sign up with email" />

          {/* 30 characters each — the same limit the backend enforces. */}
          <AuthInput
            label="First Name"
            placeholder="Enter your first name"
            value={firstName}
            onChangeText={setFirstName}
            autoCapitalize="words"
            autoComplete="given-name"
            textContentType="givenName"
            maxLength={30}
          />
          <AuthInput
            label="Last Name"
            placeholder="Enter your last name"
            value={lastName}
            onChangeText={setLastName}
            autoCapitalize="words"
            autoComplete="family-name"
            textContentType="familyName"
            maxLength={30}
          />
          <AuthInput
            label="Email Address"
            placeholder="Enter your email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
          />

          <RoleSelector
            role={role}
            onRoleChange={setRole}
            pwdDeclared={pwdDeclared}
            onPwdDeclaredChange={setPwdDeclared}
          />

          <AuthInput
            label="Password"
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            isPassword
          />
          <AuthInput
            label="Confirm Password"
            placeholder="Confirm password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            isPassword
          />

          <TermsConsent accepted={acceptedTerms} onChange={setAcceptedTerms} />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {emailInUse ? (
            <View style={styles.inUse} accessibilityLiveRegion="polite">
              <Text style={styles.errorText}>
                This email already has an account.
                {emailInUse.google ? ' It uses Continue with Google.' : ''}
              </Text>
              <TouchableOpacity
                onPress={() => router.replace({ pathname: '/login', params: { email: email.trim() } })}
                style={styles.inUseButton}
                accessibilityRole="button"
              >
                <Text style={styles.linkAccent}>Log in instead</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <PrimaryButton
            title="Create Account"
            loadingTitle="Creating account…"
            onPress={() => void handleRegister()}
            loading={loading}
            disabled={!firstName.trim() || !lastName.trim() || !email || !password || !role || !consentGiven}
          />

          <TouchableOpacity onPress={() => router.push('/login')} style={styles.linkWrap}>
            <Text style={styles.linkText}>
              {'Already have an account? '}
              <Text style={styles.linkAccent}>Login</Text>
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
      marginBottom: 24,
    },
    title: {
      marginTop: 12,
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
    errorText: {
      color: t.colors.dangerText,
      textAlign: 'center',
      marginBottom: 12,
    },
    inUse: {
      alignItems: 'center',
      marginBottom: 8,
    },
    inUseButton: {
      minHeight: 44,
      justifyContent: 'center',
      marginTop: -8,
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
