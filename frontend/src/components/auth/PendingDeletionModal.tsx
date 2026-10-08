import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Spacing } from '@/constants/theme';
import { daysUntil, formatLongDate } from '@/utils/dates';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';

type PendingDeletionModalProps = {
  /** When the account will be erased (ISO string from the server), or null to hide. */
  deletionScheduledFor: string | null;
  restoring: boolean;
  error: string;
  onRestore: () => void;
  onLogOut: () => void;
};

/**
 * Shown on the login screen when the account someone just logged into is
 * waiting to be deleted. Restoring cancels the deletion and logs them in;
 * logging out leaves the countdown running. Same backdrop/sheet look as
 * RenameConversationModal.
 */
export function PendingDeletionModal({
  deletionScheduledFor,
  restoring,
  error,
  onRestore,
  onLogOut,
}: PendingDeletionModalProps) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);

  const date = deletionScheduledFor ? new Date(deletionScheduledFor) : null;
  const days = date ? daysUntil(date) : 0;

  return (
    <Modal visible={date !== null} transparent animationType="fade" onRequestClose={onLogOut}>
      <View style={styles.backdrop}>
        <View style={styles.sheet} accessibilityViewIsModal>
          <Ionicons name="warning-outline" size={36} color={colors.dangerText} />
          <Text style={styles.title} accessibilityRole="header">
            This account is scheduled for deletion
          </Text>
          {date ? (
            <Text style={styles.body}>
              It will be permanently deleted on{' '}
              <Text style={styles.bold}>{formatLongDate(date)}</Text> ({days} {days === 1 ? 'day' : 'days'} left),
              along with your emergency contacts, conversations and SOS history.
            </Text>
          ) : null}
          <Text style={styles.body}>
            Restore it to keep using AccessAI, or log out and the deletion will go ahead.
          </Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.primaryButton, restoring && styles.disabledButton]}
            onPress={onRestore}
            disabled={restoring}
            accessibilityRole="button"
            accessibilityState={{ disabled: restoring, busy: restoring }}
          >
            {restoring ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.primaryButtonText}>Restore my account</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={onLogOut}
            disabled={restoring}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryButtonText}>Log out</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
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
    error: {
      color: t.colors.dangerText,
      textAlign: 'center',
      marginBottom: 8,
    },
    primaryButton: {
      width: '100%',
      minHeight: 48,
      backgroundColor: t.colors.primary,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 10,
    },
    disabledButton: {
      opacity: 0.6,
    },
    primaryButtonText: {
      color: t.colors.onPrimary,
      fontWeight: t.weight('700'),
      fontSize: t.font(15),
    },
    secondaryButton: {
      width: '100%',
      minHeight: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: t.colors.border,
      marginTop: 10,
    },
    secondaryButtonText: {
      color: t.colors.textSecondary,
      fontWeight: t.weight('700'),
      fontSize: t.font(15),
    },
  });
