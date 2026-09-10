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

type LoginResponse = {
  token: string;
};

export default function LoginScreen() {
  const { signIn } = useBootstrap();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
      setError(e instanceof Error ? e.message : 'Login failed');
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
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <PrimaryButton
            title="Login"
            onPress={() => void handleLogin()}
            loading={loading}
            disabled={!email || !password}
          />
          <TouchableOpacity onPress={() => router.push('/register')} style={styles.linkWrap}>
            <Text style={styles.linkText}>
              {"Don't have an account? "}
              <Text style={styles.linkAccent}>Register</Text>
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
    marginBottom: 28,
  },
  title: {
    marginTop: 16,
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
