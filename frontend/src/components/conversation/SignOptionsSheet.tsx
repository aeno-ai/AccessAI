import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SignChoices } from '@/components/sign/SignChoices';
import { ToggleRow } from '@/components/ui/ToggleRow';
import { useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { usePreferences } from '@/hooks/use-preferences';
import type { SignModelInfo } from '@/hooks/use-sign-recognition';

type Props = {
  visible: boolean;
  models: SignModelInfo[] | null;
  onClose: () => void;
};

/** Opened from the "FSL · Words ▾" button on the camera: big, clear choices. */
export function SignOptionsSheet({ visible, models, onClose }: Props) {
  const { prefs, setPref } = usePreferences();
  const styles = useThemedStyles(makeStyles);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
      <View style={styles.sheet} accessibilityViewIsModal>
        <Text style={styles.title} accessibilityRole="header">
          Sign language
        </Text>
        <ScrollView contentContainerStyle={styles.content}>
          <SignChoices models={models} />
          <View style={styles.toggleCard}>
            <ToggleRow
              label="Signs read wrong? Flip the video"
              description="Only if most signs come out wrong."
              value={prefs.signFlip}
              onValueChange={(value) => setPref('signFlip', value)}
            />
          </View>
        </ScrollView>
        <Pressable style={styles.done} onPress={onClose} accessibilityRole="button">
          <Text style={styles.doneText}>Done</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: t.colors.overlay,
    },
    sheet: {
      maxHeight: '85%',
      backgroundColor: t.colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 28,
    },
    title: {
      fontSize: t.font(20),
      fontWeight: t.weight('900'),
      color: t.colors.textPrimary,
    },
    content: {
      paddingBottom: 16,
      gap: 12,
    },
    toggleCard: {
      marginTop: 8,
      borderWidth: 1,
      borderColor: t.colors.border,
      borderRadius: 14,
      backgroundColor: t.colors.surface,
      overflow: 'hidden',
    },
    done: {
      minHeight: 52,
      borderRadius: 26,
      backgroundColor: t.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    doneText: {
      fontSize: t.font(17),
      fontWeight: t.weight('800'),
      color: t.colors.onPrimary,
    },
  });
