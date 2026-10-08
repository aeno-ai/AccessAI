import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { AuthInput } from '@/components/auth/AuthInput';
import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { IconButton } from '@/components/ui/IconButton';
import { KeyboardAvoider } from '@/components/ui/KeyboardAvoider';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { SectionHeader } from '@/components/ui/SettingRow';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { useIsOnline } from '@/hooks/use-is-online';
import { announce } from '@/utils/a11y';
import {
  deleteContact,
  getCachedContacts,
  PHONE_PATTERN,
  refreshContacts,
  saveContact,
  type EmergencyContact,
} from '@/utils/emergencyContacts';

const EMPTY_FORM = { name: '', phoneNumber: '', relationship: '' };

/**
 * The people an SOS is texted to. Texts go over the mobile network, so they
 * still work with no internet — which is why the list is also kept on the
 * phone. Changing it needs the internet (it's saved to the account).
 */
export default function EmergencyContactsScreen() {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const online = useIsOnline();

  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Phone copy first (instant, offline), then the server's if reachable.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void getCachedContacts().then((cached) => {
        if (!cancelled) setContacts(cached);
      });
      refreshContacts()
        .then((fresh) => {
          if (!cancelled) setContacts(fresh);
        })
        .catch(() => {
          // Offline — the copy on the phone is shown.
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const name = form.name.trim();
  const phoneNumber = form.phoneNumber.trim();
  const phoneValid = PHONE_PATTERN.test(phoneNumber);
  const canSave = online && Boolean(name) && phoneValid && !saving;

  const startEditing = (contact: EmergencyContact) => {
    setEditingId(contact._id);
    setForm({ name: contact.name, phoneNumber: contact.phoneNumber, relationship: contact.relationship ?? '' });
    setError('');
  };

  const cancelEditing = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError('');
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const relationship = form.relationship.trim();
      const next = await saveContact({ name, phoneNumber, ...(relationship ? { relationship } : {}) }, editingId ?? undefined);
      setContacts(next);
      announce(editingId ? `${name} updated` : `${name} added`);
      setEditingId(null);
      setForm(EMPTY_FORM);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Could not save the contact.';
      setError(message);
      announce(message);
    } finally {
      setSaving(false);
    }
  };

  const remove = (contact: EmergencyContact) => {
    Alert.alert('Remove contact?', `${contact.name} won't get your SOS texts any more.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          deleteContact(contact._id)
            .then((next) => {
              setContacts(next);
              announce(`${contact.name} removed`);
            })
            .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Could not remove the contact.'));
        },
      },
    ]);
  };

  return (
    <ScreenShell maxWidth={MaxContentWidth.app}>
      <KeyboardAvoider>
        <View style={styles.header}>
          <IconButton icon="arrow-back" label="Go back" onPress={() => router.back()} />
          <Text style={styles.headerTitle} accessibilityRole="header">
            Emergency contacts
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>
            When you send an SOS, AccessAI can open a text to these people with your message and location.
            Texts work even without internet.
          </Text>

          <SectionHeader title={`Saved (${contacts.length})`} />
          {contacts.length === 0 ? <Text style={styles.empty}>No emergency contacts yet. Add one below.</Text> : null}
          {contacts.length > 0 ? (
            <View style={styles.card}>
              {contacts.map((contact, index) => (
                <View key={contact._id} style={[styles.contactRow, index > 0 && styles.divided]}>
                  <View
                    style={styles.contactText}
                    accessible
                    accessibilityLabel={`${contact.name}${contact.relationship ? `, ${contact.relationship}` : ''}. ${contact.phoneNumber}`}
                  >
                    <Text style={styles.contactName}>{contact.name}</Text>
                    <Text style={styles.contactMeta}>
                      {[contact.relationship, contact.phoneNumber].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                  <IconButton
                    icon="create-outline"
                    label={`Edit ${contact.name}`}
                    color={colors.primary}
                    disabled={!online}
                    onPress={() => startEditing(contact)}
                  />
                  <IconButton
                    icon="trash-outline"
                    label={`Remove ${contact.name}`}
                    color={colors.dangerText}
                    disabled={!online}
                    onPress={() => remove(contact)}
                  />
                </View>
              ))}
            </View>
          ) : null}

          <SectionHeader title={editingId ? 'Edit contact' : 'Add a contact'} />
          <AuthInput
            label="Name"
            value={form.name}
            onChangeText={(value) => setForm((current) => ({ ...current, name: value }))}
            autoCapitalize="words"
            maxLength={100}
          />
          <AuthInput
            label="Mobile number"
            value={form.phoneNumber}
            onChangeText={(value) => setForm((current) => ({ ...current, phoneNumber: value }))}
            keyboardType="phone-pad"
            placeholder="e.g. 0917 123 4567"
            maxLength={20}
          />
          {phoneNumber && !phoneValid ? (
            <Text style={styles.error} accessibilityLiveRegion="polite">
              Enter a valid phone number.
            </Text>
          ) : null}
          <AuthInput
            label="Relationship (optional)"
            value={form.relationship}
            onChangeText={(value) => setForm((current) => ({ ...current, relationship: value }))}
            autoCapitalize="sentences"
            placeholder="e.g. Nanay, Kuya, Neighbor"
            maxLength={50}
          />

          {!online ? (
            <Text style={styles.note} accessibilityLiveRegion="polite">
              Connect to the internet to add or change contacts. The list above still works offline.
            </Text>
          ) : null}
          {error ? (
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}

          <PrimaryButton
            title={editingId ? 'Save changes' : 'Add contact'}
            onPress={() => void save()}
            loading={saving}
            disabled={!canSave}
          />
          {editingId ? (
            <View style={styles.cancelWrap}>
              <PrimaryButton title="Cancel editing" onPress={cancelEditing} />
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoider>
    </ScreenShell>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.two,
      paddingTop: Spacing.two,
    },
    headerTitle: {
      flex: 1,
      textAlign: 'center',
      fontSize: t.font(17),
      fontWeight: t.weight('800'),
      color: t.colors.textPrimary,
    },
    headerSpacer: {
      width: 48,
    },
    content: {
      padding: Spacing.four,
      paddingTop: Spacing.two,
      paddingBottom: Spacing.six,
    },
    intro: {
      fontSize: t.font(14),
      lineHeight: t.lineHeight(20),
      color: t.colors.textSecondary,
    },
    empty: {
      fontSize: t.font(14),
      color: t.colors.textSecondary,
    },
    card: {
      borderWidth: 1,
      borderColor: t.colors.border,
      borderRadius: 14,
      backgroundColor: t.colors.surface,
      overflow: 'hidden',
    },
    contactRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: 14,
      paddingRight: 4,
      paddingVertical: 6,
    },
    divided: {
      borderTopWidth: 1,
      borderTopColor: t.colors.border,
    },
    contactText: {
      flex: 1,
    },
    contactName: {
      fontSize: t.font(15),
      fontWeight: t.weight('700'),
      color: t.colors.textPrimary,
    },
    contactMeta: {
      marginTop: 2,
      fontSize: t.font(13),
      color: t.colors.textSecondary,
    },
    note: {
      marginBottom: 12,
      fontSize: t.font(13),
      lineHeight: t.lineHeight(18),
      color: t.colors.textSecondary,
    },
    error: {
      marginTop: -8,
      marginBottom: 12,
      fontSize: t.font(13),
      color: t.colors.dangerText,
    },
    cancelWrap: {
      marginTop: Spacing.two,
    },
  });
