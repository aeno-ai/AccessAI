import { useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { AuthInput } from '../../components/auth/AuthInput';
import { PrimaryButton } from '../../components/auth/PrimaryButton';
import { apiFetch } from '../../api/apiClient';
import { colors } from '../../constants/theme';

export default function RegisterScreen() {
  const [name, setName] = useState('');
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
      await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, role }),
      });
      router.replace('./login');
    } catch (e: any) {
      setError(e.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Sign up to get started</Text>

        <AuthInput label="Full Name" placeholder="Enter your Full Name" value={name} onChangeText={setName} />
        <AuthInput label="Email Address" placeholder="Enter your email" value={email} onChangeText={setEmail} keyboardType="email-address" />

        <View style={styles.roleContainer}>
          <Text style={styles.label}>I am</Text>
          <View style={styles.roleToggle}>
            <TouchableOpacity style={[styles.roleOption, role === 'pwd' && styles.roleOptionActive]} onPress={() => setRole('pwd')}>
              <Text style={[styles.roleText, role === 'pwd' && styles.roleTextActive]}>PWD</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.roleOption, role === 'non_pwd' && styles.roleOptionActive]} onPress={() => setRole('non_pwd')}>
              <Text style={[styles.roleText, role === 'non_pwd' && styles.roleTextActive]}>Non-PWD</Text>
            </TouchableOpacity>
          </View>
        </View>

        <AuthInput label="Password" placeholder="Enter your password" value={password} onChangeText={setPassword} isPassword />
        <AuthInput label="Confirm Password" placeholder="Confirm Password" value={confirmPassword} onChangeText={setConfirmPassword} isPassword />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <PrimaryButton title="Create Account" onPress={handleRegister} loading={loading} disabled={!name || !email || !password} />

        <TouchableOpacity onPress={() => router.push('./login')} style={styles.linkWrap}>
          <Text style={styles.linkText}>Already have an account? <Text style={styles.linkAccent}>Login</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '700', color: colors.textDark, textAlign: 'center' },
  subtitle: { fontSize: 14, color: colors.textMuted, textAlign: 'center', marginBottom: 24 },
  label: { color: colors.primary, fontWeight: '600', marginBottom: 6, fontSize: 14 },
  roleContainer: { width: '100%', marginBottom: 16 },
  roleToggle: { flexDirection: 'row', gap: 10 },
  roleOption: { flex: 1, borderWidth: 1, borderColor: colors.inputBorder, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  roleOptionActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  roleText: { color: colors.textDark, fontWeight: '600' },
  roleTextActive: { color: '#fff' },
  errorText: { color: colors.error, textAlign: 'center', marginBottom: 12 },
  linkWrap: { marginTop: 20, alignItems: 'center' },
  linkText: { color: colors.textMuted, fontSize: 14 },
  linkAccent: { color: colors.primary, fontWeight: '700' },
});