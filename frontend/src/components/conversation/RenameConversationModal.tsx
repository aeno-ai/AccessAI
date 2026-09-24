import { useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, Spacing } from '@/constants/theme';

type RenameConversationModalProps = {
  visible: boolean;
  initialTitle: string;
  onCancel: () => void;
  onSave: (title: string) => void;
};

/**
 * Small "rename this conversation" dialog, used from both History and the
 * conversation screen's header. A custom Modal rather than Alert.prompt,
 * which only exists on iOS. Same backdrop/sheet look as SosModal.
 */
export function RenameConversationModal({ visible, initialTitle, onCancel, onSave }: RenameConversationModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      {/* Mounted fresh each time it opens, so the box always starts with the
          conversation's current title. */}
      {visible ? <RenameSheet initialTitle={initialTitle} onCancel={onCancel} onSave={onSave} /> : null}
    </Modal>
  );
}

function RenameSheet({ initialTitle, onCancel, onSave }: Omit<RenameConversationModalProps, 'visible'>) {
  const [title, setTitle] = useState(initialTitle);
  const trimmed = title.trim();
  const canSave = trimmed.length > 0 && trimmed !== initialTitle;

  const save = () => {
    if (canSave) {
      onSave(trimmed);
    }
  };

  return (
    <View style={styles.backdrop}>
      <View style={styles.sheet}>
        <Ionicons name="create-outline" size={32} color={colors.primary} />
        <Text style={styles.title}>Rename conversation</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          maxLength={100}
          autoFocus
          selectTextOnFocus
          returnKeyType="done"
          onSubmitEditing={save}
          placeholder="e.g. Ate Lyka, Dagupan trip"
          placeholderTextColor={colors.textMuted}
          accessibilityLabel="Conversation name"
        />
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.secondaryButton} onPress={onCancel} accessibilityRole="button">
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryButton, !canSave && styles.disabledButton]}
            onPress={save}
            disabled={!canSave}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSave }}
          >
            <Text style={styles.primaryButtonText}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20, 16, 36, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: Spacing.four,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 10,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 16,
    fontSize: 15,
    color: colors.textPrimary,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
    width: '100%',
  },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 24,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledButton: {
    backgroundColor: colors.border,
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 24,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.textSecondary,
    fontWeight: '700',
    fontSize: 14,
  },
});
