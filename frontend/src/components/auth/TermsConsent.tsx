import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { ConsentCheckbox } from '@/components/ui/ConsentCheckbox';
import { useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';

type TermsConsentProps = {
  accepted: boolean;
  onChange: (accepted: boolean) => void;
};

/** The "I agree to the terms" tick box, with a link to read them. */
export function TermsConsent({ accepted, onChange }: TermsConsentProps) {
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={styles.termsContainer}>
      {/* A separate link rather than one nested in the checkbox label,
          so screen readers get two clear controls instead of one. */}
      <TouchableOpacity
        onPress={() => router.push('/terms')}
        style={styles.termsLink}
        accessibilityRole="link"
      >
        <Text style={styles.linkAccent}>Read the Terms of Use and Privacy Notice</Text>
      </TouchableOpacity>
      <ConsentCheckbox
        checked={accepted}
        onChange={onChange}
        label="I have read and agree to the Terms of Use and Privacy Notice."
      />
      
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    termsContainer: {
      width: '100%',
      marginBottom: 16,
    },
    termsLink: {
      minHeight: 44,
      justifyContent: 'center',
      paddingLeft: 36,
    },
    linkAccent: {
      color: t.colors.primary,
      fontWeight: t.weight('700'),
    },
  });
