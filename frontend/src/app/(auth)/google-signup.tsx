import { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AuthInput } from '@/components/auth/AuthInput';
import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { RoleSelector } from '@/components/auth/RoleSelector';
import { TermsConsent } from '@/components/auth/TermsConsent';
import { AppLogo } from '@/components/onboarding/Illustrations';
import { KeyboardAvoider } from '@/components/ui/KeyboardAvoider';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { MaxContentWidth } from '@/constants/theme';
import { apiFetch } from '@/api/apiClient';
import { useBootstrap, type UserRole } from '@/hooks/use-bootstrap';
import { useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';

type CompleteResponse = {
  token: string;
};

type Params = {
  signupTicket: string;
  email: string;
  firstName?: string;
  lastName?: string;
};

/**
 * The rest of sign-up for someone who continued with Google: Google gives
 * us their email (already verified) and a name to start from, but not their
 * account type or their consent. Opened by GoogleSignInButton.
 */
export default function GoogleSignupScreen() {
  const styles = useThemedStyles(makeStyles);

  const { signIn } = useBootstrap();
  const params = useLocalSearchParams<Params>();
  const [firstName, setFirstName] = useState(params.firstName ?? '');
  const [lastName, setLastName] = useState(params.lastName ?? '');
  // No default, same as Register: nobody ends up a PWD by preselection.
  const [role, setRole] = useState<UserRole | null>(null);
  const [pwdDeclared, setPwdDeclared] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const consentGiven = acceptedTerms && (role !== 'pwd' || pwdDeclared);

  const handleCreate = async () => {
    setError('');
    if (!role || !consentGiven) {
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch<CompleteResponse>('/auth/google/complete', {
        method: 'POST',
        body: JSON.stringify({
          signupTicket: params.signupTicket,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          role,
          acceptedTerms,
          pwdDeclaration: role === 'pwd' && pwdDeclared,
        }),
      });
      // The root layout's guards take the new user on into onboarding.
      await signIn(data.token);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not create your account');
      setLoading(false);
    }
  };

  return (
    <ScreenShell maxWidth={MaxContentWidth.auth}>
      <KeyboardAvoider>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <AppLogo size={64} />
            <Text style={styles.title} accessibilityRole="header">
              Almost done
            </Text>
            <Text style={styles.subtitle}>
              Finish creating your account for <Text style={styles.bold}>{params.email}</Text>
            </Text>
          </View>

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

          <RoleSelector
            role={role}
            onRoleChange={setRole}
            pwdDeclared={pwdDeclared}
            onPwdDeclaredChange={setPwdDeclared}
          />

          <TermsConsent accepted={acceptedTerms} onChange={setAcceptedTerms} />

          {error ? (
            <Text style={styles.errorText} accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}

          <PrimaryButton
            title="Create Account"
            onPress={() => void handleCreate()}
            loading={loading}
            disabled={!firstName.trim() || !lastName.trim() || !role || !consentGiven}
          />

          <TouchableOpacity onPress={() => router.back()} style={styles.linkWrap} accessibilityRole="button">
            <Text style={styles.linkText}>
              {'Not you? '}
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
      lineHeight: t.lineHeight(20),
      color: t.colors.textMuted,
      textAlign: 'center',
      marginTop: 6,
    },
    bold: {
      fontWeight: t.weight('700'),
      color: t.colors.textPrimary,
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
    },
  });
