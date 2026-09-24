import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { AuthInput } from '@/components/auth/AuthInput';
import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { AppLogo } from '@/components/onboarding/Illustrations';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { colors, MaxContentWidth } from '@/constants/theme';
import { apiFetch } from '@/api/apiClient';
import { useBootstrap } from '@/hooks/use-bootstrap';

type RegisterResponse = {
  token: string;
};

export default function RegisterScreen() {
  const { signIn } = useBootstrap();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<'pwd' | 'non_pwd'>('pwd');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async () => {
    setError('');
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
        }),
      });
      // Logs the new user straight in. The root layout's guards then take
      // them into onboarding (or the dashboard, if this device has already
      // been through it) — no second password entry needed.
      await signIn(data.token);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenShell maxWidth={MaxContentWidth.auth}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <AppLogo size={64} />
            <Text style={styles.title}>Create account</Text>
            <Text style={styles.subtitle}>Sign up to get started</Text>
          </View>

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

          <View style={styles.roleContainer}>
            <Text style={styles.label}>I am</Text>
            <View style={styles.roleToggle}>
              <TouchableOpacity
                style={[styles.roleOption, role === 'pwd' && styles.roleOptionActive]}
                onPress={() => setRole('pwd')}
              >
                <Text style={[styles.roleText, role === 'pwd' && styles.roleTextActive]}>PWD</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.roleOption, role === 'non_pwd' && styles.roleOptionActive]}
                onPress={() => setRole('non_pwd')}
              >
                <Text style={[styles.roleText, role === 'non_pwd' && styles.roleTextActive]}>Non-PWD</Text>
              </TouchableOpacity>
            </View>
          </View>

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

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <PrimaryButton
            title="Create Account"
            onPress={() => void handleRegister()}
            loading={loading}
            disabled={!firstName.trim() || !lastName.trim() || !email || !password}
          />

          <TouchableOpacity onPress={() => router.push('/login')} style={styles.linkWrap}>
            <Text style={styles.linkText}>
              {'Already have an account? '}
              <Text style={styles.linkAccent}>Login</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
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
    fontSize: 26,
    fontWeight: '800',
    color: colors.textDark,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
  },
  label: {
    color: colors.primary,
    fontWeight: '600',
    marginBottom: 6,
    fontSize: 14,
  },
  roleContainer: {
    width: '100%',
    marginBottom: 16,
  },
  roleToggle: {
    flexDirection: 'row',
    gap: 10,
  },
  roleOption: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  roleOptionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  roleText: {
    color: colors.textDark,
    fontWeight: '600',
  },
  roleTextActive: {
    color: colors.white,
  },
  errorText: {
    color: colors.error,
    textAlign: 'center',
    marginBottom: 12,
  },
  linkWrap: {
    marginTop: 20,
    alignItems: 'center',
  },
  linkText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  linkAccent: {
    color: colors.primary,
    fontWeight: '700',
  },
});
