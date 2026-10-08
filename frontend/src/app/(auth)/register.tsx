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
import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { RoleSelector } from '@/components/auth/RoleSelector';
import { TermsConsent } from '@/components/auth/TermsConsent';
import { AppLogo } from '@/components/onboarding/Illustrations';
import { KeyboardAvoider } from '@/components/ui/KeyboardAvoider';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { MaxContentWidth } from '@/constants/theme';
import { apiFetch } from '@/api/apiClient';
import type { UserRole } from '@/hooks/use-bootstrap';
import { useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';

type RegisterResponse = {
  // false if the verification email couldn't be sent just now.
  codeSent: boolean;
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

  const consentGiven = acceptedTerms && (role !== 'pwd' || pwdDeclared);

  const handleRegister = async () => {
    setError('');
    if (!role || !consentGiven) {
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
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
      // second password entry needed.
      router.push({
        pathname: '/verify-email',
        params: { email: email.trim(), codeSent: data.codeSent ? '1' : '0' },
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Registration failed');
    } finally {
      setLoading(false);
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

          <PrimaryButton
            title="Create Account"
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
