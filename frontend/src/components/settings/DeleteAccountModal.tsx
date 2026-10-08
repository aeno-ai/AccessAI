import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthInput } from '@/components/auth/AuthInput';
import { apiFetch } from '@/api/apiClient';
import { RESEND_CODE_SECONDS } from '@/constants/auth';
import { DELETION_GRACE_DAYS } from '@/constants/legal';
import { Spacing } from '@/constants/theme';
import { useCountdown } from '@/hooks/use-countdown';
import { formatLongDate } from '@/utils/dates';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';

type DeleteAccountModalProps = {
  visible: boolean;
  onCancel: () => void;
  /** Called once the backend has scheduled the deletion. */
  onScheduled: () => void;
};

type MeResponse = {
  user: { hasPassword: boolean };
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Asks for the password — or, for an account created with Google (which has
 * none), a code emailed to it — then schedules the account for deletion. Nothing
 * is erased yet: the backend waits DELETION_GRACE_DAYS, and logging in
 * before then offers to restore the account. Chats saved on this phone are
 * deliberately left alone — the app can't download them again, so wiping
 * them would make restoring the account come back to an empty history.
 */
export function DeleteAccountModal({ visible, onCancel, onScheduled }: DeleteAccountModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      {/* Mounted fresh each time it opens, so no password is left over. */}
      {visible ? <DeleteSheet onCancel={onCancel} onScheduled={onScheduled} /> : null}
    </Modal>
  );
}

function DeleteSheet({ onCancel, onScheduled }: Omit<DeleteAccountModalProps, 'visible'>) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);

  // null until the backend says which kind of confirmation this account needs.
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [codeSentTo, setCodeSentTo] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  const [resendIn, restartResendTimer] = useCountdown();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // For the explanation only; the backend sets the real date. Worked out
  // once when the sheet opens, not on every render.
  const [deletionDate] = useState(() => formatLongDate(new Date(Date.now() + DELETION_GRACE_DAYS * DAY_MS)));

  useEffect(() => {
    let cancelled = false;
    apiFetch<MeResponse>('/auth/me')
      .then((data) => {
        if (!cancelled) setHasPassword(data.user.hasPassword);
      })
      .catch(() => {
        if (!cancelled) setError('Could not reach AccessAI. Check your connection and try again.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sendCode = async () => {
    setError('');
    setSendingCode(true);
    try {
      const data = await apiFetch<{ email: string }>('/auth/me/deletion-code', { method: 'POST' });
      setCodeSentTo(data.email);
      setCode('');
      restartResendTimer(RESEND_CODE_SECONDS);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not send a code');
    } finally {
      setSendingCode(false);
    }
  };

  const confirmation = hasPassword ? password : code.length === 6 ? code : '';

  const confirm = async () => {
    setError('');
    setLoading(true);
    try {
      await apiFetch('/auth/me', {
        method: 'DELETE',
        body: JSON.stringify(hasPassword ? { password } : { code }),
      });
      onScheduled();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not delete your account');
      setLoading(false);
    }
  };

  return (
    <View style={styles.backdrop}>
      <View style={styles.sheet} accessibilityViewIsModal>
        <View style={styles.iconWrap}>
          <Ionicons name="trash-outline" size={32} color={colors.dangerText} />
        </View>
        <Text style={styles.title} accessibilityRole="header">
          Delete your account?
        </Text>
        <Text style={styles.body}>
          Your account will be deleted in {DELETION_GRACE_DAYS} days. You&apos;ll be logged out on all
          devices. Log in before <Text style={styles.bold}>{deletionDate}</Text> to cancel.
        </Text>
        <Text style={styles.body}>
          After that, your account, emergency contacts, conversations and SOS history are permanently
          erased.
        </Text>

        {hasPassword === null && !error ? (
          <ActivityIndicator color={colors.primary} style={styles.inputWrap} />
        ) : null}

        {hasPassword ? (
          <View style={styles.inputWrap}>
            <AuthInput
              label="Enter your password to confirm"
              placeholder="Password"
              value={password}
              onChangeText={setPassword}
              isPassword
            />
          </View>
        ) : null}

        {hasPassword === false ? (
          <View style={styles.inputWrap}>
            <Text style={styles.body}>
              {codeSentTo
                ? `We sent a 6-digit code to ${codeSentTo}.`
                : "Your account doesn't have a password, so we'll email you a code to confirm."}
            </Text>
            {codeSentTo ? (
              <AuthInput
                label="Enter the code to confirm"
                placeholder="123456"
                value={code}
                onChangeText={(text) => setCode(text.replace(/\D/g, ''))}
                keyboardType="number-pad"
                maxLength={6}
                textContentType="oneTimeCode"
                autoComplete="one-time-code"
              />
            ) : null}
            <TouchableOpacity
              style={[styles.codeButton, (resendIn > 0 || sendingCode) && styles.disabledButton]}
              onPress={() => void sendCode()}
              disabled={resendIn > 0 || sendingCode}
              accessibilityRole="button"
              accessibilityState={{ disabled: resendIn > 0 || sendingCode, busy: sendingCode }}
            >
              {sendingCode ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <Text style={styles.codeButtonText}>
                  {!codeSentTo ? 'Email me a code' : resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={onCancel}
            disabled={loading}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.dangerButton, (!confirmation || loading) && styles.disabledButton]}
            onPress={() => void confirm()}
            disabled={!confirmation || loading}
            accessibilityRole="button"
            accessibilityState={{ disabled: !confirmation || loading, busy: loading }}
          >
            {loading ? (
              <ActivityIndicator color={colors.onDanger} />
            ) : (
              <Text style={styles.dangerButtonText}>Delete account</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: t.colors.overlay,
      alignItems: 'center',
      justifyContent: 'center',
      padding: Spacing.four,
    },
    sheet: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: t.colors.surface,
      borderRadius: 20,
      padding: Spacing.four,
    },
    iconWrap: {
      alignItems: 'center',
    },
    title: {
      fontSize: t.font(18),
      fontWeight: t.weight('800'),
      color: t.colors.textPrimary,
      marginTop: 10,
      marginBottom: 8,
      textAlign: 'center',
    },
    body: {
      fontSize: t.font(14),
      lineHeight: t.lineHeight(20),
      color: t.colors.textSecondary,
      textAlign: 'center',
      marginBottom: 8,
    },
    bold: {
      fontWeight: t.weight('700'),
      color: t.colors.textPrimary,
    },
    inputWrap: {
      marginTop: 8,
    },
    codeButton: {
      minHeight: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: t.colors.primary,
      marginBottom: 12,
    },
    codeButtonText: {
      color: t.colors.primary,
      fontWeight: t.weight('700'),
      fontSize: t.font(14),
    },
    error: {
      color: t.colors.dangerText,
      textAlign: 'center',
      marginBottom: 8,
    },
    actionsRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 8,
    },
    secondaryButton: {
      flex: 1,
      minHeight: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    secondaryButtonText: {
      color: t.colors.textSecondary,
      fontWeight: t.weight('700'),
      fontSize: t.font(14),
    },
    dangerButton: {
      flex: 1,
      minHeight: 48,
      backgroundColor: t.colors.danger,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
    disabledButton: {
      opacity: 0.5,
    },
    dangerButtonText: {
      color: t.colors.onDanger,
      fontWeight: t.weight('700'),
      fontSize: t.font(14),
    },
  });
