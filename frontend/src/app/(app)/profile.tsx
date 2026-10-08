import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { apiFetch } from '@/api/apiClient';
import { AuthInput } from '@/components/auth/AuthInput';
import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { IconButton } from '@/components/ui/IconButton';
import { KeyboardAvoider } from '@/components/ui/KeyboardAvoider';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { useBootstrap } from '@/hooks/use-bootstrap';
import { useIsOnline } from '@/hooks/use-is-online';
import { announce } from '@/utils/a11y';

type Profile = { email: string; firstName: string; lastName: string; friendCode?: string; friendNote: string };
type MeResponse = { user: Profile };
type UpdateResponse = { token: string; user: Profile };

const MAX_NAME_LENGTH = 30;
const MAX_NOTE_LENGTH = 80;

/**
 * "Edit profile" — the person icon on Home and the first item in the menu.
 * Only personal details live here; accessibility preferences are in the
 * Settings tab. Saving needs the internet (the name lives on the account),
 * and the new name shows offline straight after, because the fresh login
 * token the server answers with carries it.
 */
export default function ProfileScreen() {
  const { signIn } = useBootstrap();
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const online = useIsOnline();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [friendNote, setFriendNote] = useState('');
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  // Reloaded each visit — this screen stays mounted in the drawer.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setLoadError('');
      setError('');
      setSaved(false);
      apiFetch<MeResponse>('/auth/me')
        .then(({ user }) => {
          if (cancelled) return;
          setProfile(user);
          setFirstName(user.firstName);
          setLastName(user.lastName);
          setFriendNote(user.friendNote ?? '');
        })
        .catch(() => {
          if (!cancelled) setLoadError('Connect to the internet to see and edit your profile.');
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const trimmedFirst = firstName.trim();
  const trimmedLast = lastName.trim();
  const trimmedNote = friendNote.trim();
  const changed =
    profile !== null &&
    (trimmedFirst !== profile.firstName || trimmedLast !== profile.lastName || trimmedNote !== (profile.friendNote ?? ''));
  const canSave = online && changed && Boolean(trimmedFirst) && Boolean(trimmedLast) && !saving;

  const save = async () => {
    setError('');
    setSaved(false);
    setSaving(true);
    try {
      const data = await apiFetch<UpdateResponse>('/auth/me', {
        method: 'PATCH',
        body: JSON.stringify({ firstName: trimmedFirst, lastName: trimmedLast, friendNote: trimmedNote }),
      });
      await signIn(data.token);
      setProfile(data.user);
      setFirstName(data.user.firstName);
      setLastName(data.user.lastName);
      setFriendNote(data.user.friendNote ?? '');
      setSaved(true);
      announce('Profile saved');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Could not save your profile.';
      setError(message);
      announce(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenShell maxWidth={MaxContentWidth.app}>
      <KeyboardAvoider>
        <View style={styles.header}>
          <IconButton icon="arrow-back" label="Go back" onPress={() => router.back()} />
          <Text style={styles.headerTitle} accessibilityRole="header">
            Edit profile
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {profile === null && !loadError ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : null}
          {loadError ? <Text style={styles.notice}>{loadError}</Text> : null}

          {profile ? (
            <>
              <AuthInput
                label="First name"
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
                autoComplete="given-name"
                textContentType="givenName"
                maxLength={MAX_NAME_LENGTH}
              />
              <AuthInput
                label="Last name"
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
                autoComplete="family-name"
                textContentType="familyName"
                maxLength={MAX_NAME_LENGTH}
              />

              <AuthInput
                label="Note for friends (optional)"
                value={friendNote}
                onChangeText={setFriendNote}
                autoCapitalize="sentences"
                placeholder="e.g. I'm Deaf, please type"
                maxLength={MAX_NOTE_LENGTH}
              />
              <Text style={styles.hint}>
                Shown to your friends next to your name. Only write what you&apos;re comfortable sharing.
              </Text>

              <Text style={styles.fieldLabel}>Email</Text>
              <Text style={styles.readOnly} accessibilityLabel={`Email: ${profile.email}. Can't be changed here.`}>
                {profile.email}
              </Text>

              {profile.friendCode ? (
                <>
                  <Text style={[styles.fieldLabel, styles.spaced]}>Friend code</Text>
                  <Text
                    style={styles.readOnly}
                    accessibilityLabel={`Friend code: ${profile.friendCode.replace('-', '').split('').join(' ')}. Share it so friends can add you.`}
                  >
                    {profile.friendCode}
                  </Text>
                </>
              ) : null}

              {!online ? (
                <Text style={styles.notice} accessibilityLiveRegion="polite">
                  Connect to the internet to save changes.
                </Text>
              ) : null}
              {error ? (
                <Text style={styles.error} accessibilityLiveRegion="polite">
                  {error}
                </Text>
              ) : null}
              {saved ? (
                <Text style={styles.success} accessibilityLiveRegion="polite">
                  Saved.
                </Text>
              ) : null}

              <View style={styles.saveWrap}>
                <PrimaryButton title="Save changes" onPress={() => void save()} loading={saving} disabled={!canSave} />
              </View>
            </>
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
      paddingBottom: Spacing.six,
    },
    loader: {
      marginTop: Spacing.five,
    },
    fieldLabel: {
      color: t.colors.primary,
      fontWeight: t.weight('600'),
      marginBottom: 6,
      fontSize: t.font(14),
    },
    hint: {
      marginTop: -8,
      marginBottom: 16,
      fontSize: t.font(13),
      lineHeight: t.lineHeight(18),
      color: t.colors.textSecondary,
    },
    spaced: {
      marginTop: 16,
    },
    readOnly: {
      fontSize: t.font(15),
      color: t.colors.textSecondary,
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 12,
      backgroundColor: t.colors.surfaceAlt,
      overflow: 'hidden',
    },
    notice: {
      marginTop: Spacing.three,
      fontSize: t.font(14),
      lineHeight: t.lineHeight(20),
      color: t.colors.textSecondary,
    },
    error: {
      marginTop: Spacing.three,
      fontSize: t.font(14),
      color: t.colors.dangerText,
    },
    success: {
      marginTop: Spacing.three,
      fontSize: t.font(14),
      fontWeight: t.weight('700'),
      color: t.colors.success,
    },
    saveWrap: {
      marginTop: Spacing.four,
    },
  });
