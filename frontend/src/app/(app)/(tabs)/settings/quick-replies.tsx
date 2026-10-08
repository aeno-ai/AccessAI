import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { IconButton } from '@/components/ui/IconButton';
import { SectionHeader, SettingRow } from '@/components/ui/SettingRow';
import { ToggleRow } from '@/components/ui/ToggleRow';
import { MAX_QUICK_REPLIES, MAX_QUICK_REPLY_LENGTH, suggestedQuickReplies } from '@/constants/profiles';
import { Spacing } from '@/constants/theme';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { usePreferences } from '@/hooks/use-preferences';
import { announce } from '@/utils/a11y';

/**
 * The saved replies shown as bubbles above the message box. Reordering uses
 * Move up / Move down buttons rather than dragging, which screen readers
 * can't do.
 */
export default function QuickRepliesSettingsScreen() {
  const { prefs, setPref } = usePreferences();
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const phrases = prefs.quickReplies;

  const [draft, setDraft] = useState('');
  // Index of the phrase being edited in place, if any.
  const [editing, setEditing] = useState<number | null>(null);
  const [editText, setEditText] = useState('');

  const save = (next: string[]) => setPref('quickReplies', next);

  const add = () => {
    const phrase = draft.trim();
    if (!phrase) return;
    if (phrases.includes(phrase)) {
      announce('That quick reply is already in the list');
      return;
    }
    save([...phrases, phrase]);
    setDraft('');
    announce(`Added: ${phrase}`);
  };

  const move = (index: number, by: -1 | 1) => {
    const target = index + by;
    if (target < 0 || target >= phrases.length) return;
    const next = [...phrases];
    [next[index], next[target]] = [next[target], next[index]];
    save(next);
    announce(`${phrases[index]}, moved to position ${target + 1} of ${phrases.length}`);
  };

  const remove = (index: number) => {
    const phrase = phrases[index];
    save(phrases.filter((_, i) => i !== index));
    announce(`Deleted: ${phrase}`);
  };

  const startEditing = (index: number) => {
    setEditing(index);
    setEditText(phrases[index]);
  };

  const finishEditing = () => {
    if (editing === null) return;
    const phrase = editText.trim();
    if (phrase) {
      save(phrases.map((existing, i) => (i === editing ? phrase : existing)));
    }
    setEditing(null);
  };

  const resetToSuggested = () => {
    Alert.alert('Reset quick replies?', 'Your list will be replaced with the suggested replies.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => {
          save(suggestedQuickReplies(prefs.profile));
          announce('Quick replies reset');
        },
      },
    ]);
  };

  const full = phrases.length >= MAX_QUICK_REPLIES;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.card}>
        <ToggleRow
          label="Show quick replies"
          description="Tap a reply to send it. Press and hold to edit it first."
          value={prefs.showQuickReplies}
          onValueChange={(value) => setPref('showQuickReplies', value)}
        />
      </View>

      <SectionHeader title={`Your replies (${phrases.length} of ${MAX_QUICK_REPLIES})`} />
      {phrases.length === 0 ? <Text style={styles.empty}>No quick replies yet. Add one below.</Text> : null}
      <View style={styles.list}>
        {phrases.map((phrase, index) => (
          <View key={`${index}-${phrase}`} style={[styles.item, index > 0 && styles.itemDivided]}>
            {editing === index ? (
              <TextInput
                style={[styles.input, styles.flex]}
                value={editText}
                onChangeText={setEditText}
                onSubmitEditing={finishEditing}
                onBlur={finishEditing}
                autoFocus
                maxLength={MAX_QUICK_REPLY_LENGTH}
                returnKeyType="done"
                accessibilityLabel={`Edit quick reply ${index + 1}`}
              />
            ) : (
              <Text style={styles.phrase} accessibilityLabel={`${index + 1} of ${phrases.length}: ${phrase}`}>
                {phrase}
              </Text>
            )}
            <View style={styles.actions}>
              <IconButton
                icon={editing === index ? 'checkmark' : 'create-outline'}
                label={editing === index ? 'Done editing' : `Edit: ${phrase}`}
                iconSize={20}
                color={colors.primary}
                onPress={() => (editing === index ? finishEditing() : startEditing(index))}
              />
              <IconButton
                icon="arrow-up"
                label={`Move up: ${phrase}`}
                iconSize={20}
                color={colors.textSecondary}
                disabled={index === 0}
                onPress={() => move(index, -1)}
              />
              <IconButton
                icon="arrow-down"
                label={`Move down: ${phrase}`}
                iconSize={20}
                color={colors.textSecondary}
                disabled={index === phrases.length - 1}
                onPress={() => move(index, 1)}
              />
              <IconButton
                icon="trash-outline"
                label={`Delete: ${phrase}`}
                iconSize={20}
                color={colors.dangerText}
                onPress={() => remove(index)}
              />
            </View>
          </View>
        ))}
      </View>

      <SectionHeader title="Add a reply" />
      <TextInput
        style={styles.input}
        value={draft}
        onChangeText={setDraft}
        placeholder={full ? 'The list is full' : 'e.g. Magkano po ito?'}
        placeholderTextColor={colors.textMuted}
        editable={!full}
        maxLength={MAX_QUICK_REPLY_LENGTH}
        onSubmitEditing={add}
        returnKeyType="done"
        accessibilityLabel="New quick reply"
      />
      <View style={styles.buttonWrap}>
        <PrimaryButton title="Add reply" onPress={add} disabled={full || !draft.trim()} />
      </View>
      {full ? <Text style={styles.note}>Delete one to add another — up to {MAX_QUICK_REPLIES} fit.</Text> : null}

      <View style={styles.card}>
        <SettingRow action danger icon="refresh-outline" title="Reset to suggested replies" onPress={resetToSuggested} />
      </View>
    </ScrollView>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
    content: {
      padding: Spacing.four,
      paddingTop: Spacing.two,
      paddingBottom: Spacing.six,
    },
    flex: {
      flex: 1,
    },
    card: {
      borderWidth: 1,
      borderColor: t.colors.border,
      borderRadius: 14,
      backgroundColor: t.colors.surface,
      overflow: 'hidden',
      marginTop: Spacing.three,
    },
    list: {
      borderWidth: 1,
      borderColor: t.colors.border,
      borderRadius: 14,
      backgroundColor: t.colors.surface,
      overflow: 'hidden',
    },
    empty: {
      fontSize: t.font(14),
      color: t.colors.textSecondary,
      marginBottom: 8,
    },
    item: {
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    itemDivided: {
      borderTopWidth: 1,
      borderTopColor: t.colors.border,
    },
    phrase: {
      fontSize: t.font(15),
      lineHeight: t.lineHeight(21),
      fontWeight: t.weight('600'),
      color: t.colors.textPrimary,
      paddingVertical: 6,
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      flexWrap: 'wrap',
    },
    input: {
      minHeight: 48,
      borderWidth: 1,
      borderColor: t.colors.inputBorder,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: t.font(15),
      color: t.colors.textPrimary,
      backgroundColor: t.colors.surface,
    },
    buttonWrap: {
      marginTop: Spacing.two,
    },
    note: {
      marginTop: 8,
      fontSize: t.font(13),
      color: t.colors.textMuted,
    },
  });
