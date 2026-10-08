import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { IconButton } from '@/components/ui/IconButton';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';

type BigTextCardProps = {
  visible: boolean;
  /** Shown straight away. Without it, the card asks for something to show. */
  text?: string;
  onClose: () => void;
};

// Shorter messages get bigger letters, so a few words fill the screen.
function sizeFor(length: number): number {
  if (length <= 20) return 56;
  if (length <= 60) return 44;
  if (length <= 140) return 34;
  return 28;
}

/**
 * "Show on screen": a message in very large letters for the other person to
 * read — for Deaf or mute users talking face to face. The flip button turns
 * it upside down for someone sitting across the table.
 */
export function BigTextCard({ visible, text, onClose }: BigTextCardProps) {
  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      {/* Mounted fresh each time it opens, so nothing is left over. */}
      {visible ? <Card initialText={text ?? ''} onClose={onClose} /> : null}
    </Modal>
  );
}

function Card({ initialText, onClose }: { initialText: string; onClose: () => void }) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const [draft, setDraft] = useState(initialText);
  const [shown, setShown] = useState(initialText.trim());
  const [flipped, setFlipped] = useState(false);

  if (!shown) {
    return (
      <View style={styles.screen}>
        <View style={styles.topBar}>
          <IconButton icon="close" label="Close" onPress={onClose} />
        </View>
        <View style={styles.compose}>
          <Text style={styles.composeTitle} accessibilityRole="header">
            Show on screen
          </Text>
          <Text style={styles.composeHint}>Type what you want the other person to read.</Text>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="e.g. Saan po ang sakayan ng jeep?"
            placeholderTextColor={colors.textMuted}
            accessibilityLabel="Text to show"
            multiline
            autoFocus
          />
          <PrimaryButton title="Show it big" onPress={() => setShown(draft.trim())} disabled={!draft.trim()} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <IconButton icon="close" label="Close" onPress={onClose} />
        <View style={styles.topActions}>
          <IconButton icon="create-outline" label="Change the text" onPress={() => setShown('')} />
          <IconButton
            icon="swap-vertical"
            label={flipped ? 'Turn the text back' : 'Turn the text upside down for the person opposite you'}
            selected={flipped}
            onPress={() => setFlipped((value) => !value)}
          />
        </View>
      </View>
      <Pressable style={styles.flex} onPress={onClose} accessible={false}>
        <ScrollView contentContainerStyle={styles.textWrap}>
          <Text
            style={[styles.bigText, { fontSize: sizeFor(shown.length), lineHeight: sizeFor(shown.length) * 1.2 }, flipped && styles.flipped]}
            accessibilityRole="header"
          >
            {shown}
          </Text>
        </ScrollView>
      </Pressable>
      <View style={styles.footer} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Ionicons name="hand-left-outline" size={16} color={colors.textMuted} />
        <Text style={styles.footerText}>Tap anywhere to close</Text>
      </View>
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    flex: {
      flex: 1,
    },
    screen: {
      flex: 1,
      backgroundColor: t.colors.background,
      paddingTop: 40,
    },
    topBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: 8,
    },
    topActions: {
      flexDirection: 'row',
    },
    compose: {
      flex: 1,
      padding: 24,
      gap: 16,
    },
    composeTitle: {
      fontSize: t.font(22),
      fontWeight: t.weight('800'),
      color: t.colors.textPrimary,
    },
    composeHint: {
      fontSize: t.font(15),
      color: t.colors.textSecondary,
    },
    input: {
      minHeight: 120,
      borderWidth: 1,
      borderColor: t.colors.inputBorder,
      borderRadius: 14,
      padding: 14,
      fontSize: t.font(20),
      color: t.colors.textPrimary,
      backgroundColor: t.colors.surface,
      textAlignVertical: 'top',
    },
    textWrap: {
      flexGrow: 1,
      justifyContent: 'center',
      padding: 24,
    },
    // Deliberately not scaled by the text size setting — it's already huge
    // and sized to fit the screen.
    bigText: {
      fontWeight: '800',
      color: t.colors.textPrimary,
      textAlign: 'center',
    },
    flipped: {
      transform: [{ rotate: '180deg' }],
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingBottom: 28,
    },
    footerText: {
      fontSize: t.font(13),
      color: t.colors.textMuted,
    },
  });
