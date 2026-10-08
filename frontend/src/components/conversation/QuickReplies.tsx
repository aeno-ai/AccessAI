import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';

type QuickRepliesProps = {
  phrases: string[];
  /** Tap: send the phrase as it is. */
  onSend: (phrase: string) => void;
  /** Hold: put it in the message box to change before sending. */
  onEdit: (phrase: string) => void;
};

/**
 * A row of saved replies, drawn like chat bubbles, above the message box.
 * Tap sends one straight away — what someone who can't speak needs mid-
 * conversation. Press and hold (TalkBack / VoiceOver: double-tap and hold,
 * or the "Edit before sending" action) puts it in the box to change first.
 * The list is edited in Settings → Quick replies.
 */
export function QuickReplies({ phrases, onSend, onEdit }: QuickRepliesProps) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
      accessibilityLabel="Quick replies"
    >
      {phrases.map((phrase, index) => (
        <Pressable
          key={`${index}-${phrase}`}
          onPress={() => onSend(phrase)}
          onLongPress={() => onEdit(phrase)}
          style={({ pressed }) => [styles.bubble, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`Quick reply: ${phrase}`}
          accessibilityHint="Sends it now. Double-tap and hold to edit it first."
          accessibilityActions={[
            { name: 'activate', label: 'Send' },
            { name: 'longpress', label: 'Edit before sending' },
          ]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'activate') onSend(phrase);
            if (event.nativeEvent.actionName === 'longpress') onEdit(phrase);
          }}
        >
          <Text style={styles.bubbleText} numberOfLines={2}>
            {phrase}
          </Text>
        </Pressable>
      ))}
      <Pressable
        onPress={() => router.push('/settings/quick-replies')}
        style={({ pressed }) => [styles.edit, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Edit quick replies"
      >
        <Ionicons name="create-outline" size={16} color={colors.primary} />
        <Text style={styles.editText}>Edit</Text>
      </Pressable>
    </ScrollView>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    row: {
      gap: 8,
      paddingHorizontal: 16,
      paddingBottom: 8,
      alignItems: 'center',
    },
    // Shaped like a sent chat bubble, so it reads as "something you'd say".
    bubble: {
      maxWidth: 240,
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 18,
      borderBottomRightRadius: 4,
      backgroundColor: t.colors.primaryLight,
      borderWidth: 1,
      borderColor: t.colors.primary,
    },
    bubbleText: {
      fontSize: t.font(14),
      fontWeight: t.weight('600'),
      color: t.colors.onPrimaryLight,
    },
    edit: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      minHeight: 44,
      paddingHorizontal: 12,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    editText: {
      fontSize: t.font(13),
      fontWeight: t.weight('700'),
      color: t.colors.primary,
    },
    pressed: {
      opacity: 0.7,
    },
  });
