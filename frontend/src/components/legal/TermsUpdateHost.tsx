import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, AppState, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch, isApiError } from '@/api/apiClient';
import { block, unblock } from '@/audio/recognizer';
import { Spacing } from '@/constants/theme';
import { TERMS_SECTIONS, TERMS_VERSION } from '@/constants/legal';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { usePickedVoices } from '@/hooks/use-app-voice';
import { useBootstrap } from '@/hooks/use-bootstrap';
import { usePreferences } from '@/hooks/use-preferences';
import { useScreenReader } from '@/hooks/use-screen-reader';
import { speakMixed, stopMixed } from '@/utils/speechHelper';

/**
 * "We updated our Terms" (HANDOFF.md §44): someone who agreed to older
 * Terms is asked once, the next time the app opens, to agree to the new
 * ones (or sign out). It sits inside the app, so shake-to-SOS and the SOS
 * button still work under it, and it only ever shows when the server
 * answered — never offline: if "I agree" can't reach us, it steps aside
 * and asks again next time.
 *
 * The tutorial waits for it (`pending`), and "Hey Laya" rests while it's up.
 */

type TermsUpdateValue = {
  /** Still checking, or waiting for "I agree" — tours wait. */
  pending: boolean;
};

const TermsUpdateContext = createContext<TermsUpdateValue>({ pending: false });

export function useTermsUpdate(): TermsUpdateValue {
  return useContext(TermsUpdateContext);
}

type Me = { needsTerms?: boolean; termsVersion?: string };

// What changed, in a few lines — the full Terms are right below it.
const CHANGES = [
  'We keep login and activity records (your network address, phone type and app version, and when you hit a limit) for 90 days.',
  'Our admins can see those records and your SOS records, but never where you were or your SOS message.',
  'Misuse, like spam or fake SOS alerts, can get an account paused or deleted.',
  'We explain more clearly how "Hey Laya" turns your voice into text.',
];

const OWNER = 'terms';

export function TermsUpdateProvider({ children }: { children: ReactNode }) {
  const { signOut } = useBootstrap();
  const { prefs } = usePreferences();
  const screenReader = useScreenReader();
  const voices = usePickedVoices(prefs.layaVoice === 'app' ? prefs.appVoice : prefs.layaVoice);
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const [checking, setChecking] = useState(true);
  const [needed, setNeeded] = useState(false);
  const [showFull, setShowFull] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Asks the server when the app opens, and again each time it comes back
  // (in case it was offline at first). Shown only when this app has the
  // same Terms the server wants agreed to (an older app can't show the new
  // wording). Offline or refused (a 401 signs out by itself): not now.
  useEffect(() => {
    let alive = true;
    const check = () => {
      apiFetch<Me>('/auth/me', { timeoutMs: 6000 })
        .then(
          (me) => me.needsTerms === true && me.termsVersion === TERMS_VERSION,
          () => null,
        )
        .then((needs) => {
          if (!alive) return;
          if (needs !== null) setNeeded(needs);
          setChecking(false);
        });
    };
    check();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      alive = false;
      subscription.remove();
    };
  }, []);

  // "Hey Laya" rests while this is up.
  useEffect(() => {
    if (!needed) return;
    block('terms');
    return () => unblock('terms');
  }, [needed]);

  // The Blind / low vision profile without a screen reader: read it out.
  const speakIt = prefs.profile === 'blind-low-vision' && !screenReader;
  useEffect(() => {
    if (!needed || !speakIt) return;
    void speakMixed(
      `We updated our Terms. ${CHANGES.join(' ')} To keep using AccessAI, tap "I agree" at the bottom of the screen. Or tap "Sign out" below it.`,
      { owner: OWNER, rate: prefs.speechRate, voices: voices ? { en: voices.en, fil: voices.fil } : undefined },
    );
    return () => stopMixed({ owner: OWNER });
  }, [needed, speakIt, prefs.speechRate, voices]);

  const agree = async () => {
    setError('');
    setSaving(true);
    try {
      await apiFetch('/auth/terms', { method: 'POST', body: JSON.stringify({ version: TERMS_VERSION }) });
      setNeeded(false);
    } catch (e) {
      if (!isApiError(e)) {
        // No connection: never block the app offline. Asked again next time.
        setNeeded(false);
      } else {
        setError(e.message);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <TermsUpdateContext.Provider value={{ pending: checking || needed }}>
      {children}
      <Modal visible={needed} transparent animationType="fade" onRequestClose={() => undefined}>
        <View style={styles.backdrop}>
          <View style={styles.sheet} accessibilityViewIsModal>
            <ScrollView contentContainerStyle={styles.scroll}>
              <Ionicons name="document-text-outline" size={36} color={colors.primary} style={styles.icon} />
              <Text style={styles.title} accessibilityRole="header">
                We updated our Terms
              </Text>
              <Text style={styles.body}>{"Here's what's new:"}</Text>
              {CHANGES.map((line) => (
                <Text key={line} style={styles.bullet}>
                  {`•  ${line}`}
                </Text>
              ))}

              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => setShowFull((open) => !open)}
                accessibilityRole="button"
                accessibilityState={{ expanded: showFull }}
              >
                <Text style={styles.linkText}>{showFull ? 'Hide the full Terms' : 'Read the full Terms'}</Text>
              </TouchableOpacity>

              {showFull
                ? TERMS_SECTIONS.map((section) => (
                    <View key={section.heading} style={styles.section}>
                      <Text style={styles.sectionHeading} accessibilityRole="header">
                        {section.heading}
                      </Text>
                      {section.blocks.map((block, i) =>
                        typeof block === 'string' ? (
                          <Text key={i} style={styles.paragraph}>
                            {block}
                          </Text>
                        ) : (
                          block.map((item) => (
                            <Text key={item} style={styles.bullet}>
                              {`•  ${item}`}
                            </Text>
                          ))
                        ),
                      )}
                    </View>
                  ))
                : null}
            </ScrollView>

            {error ? (
              <Text style={styles.error} accessibilityLiveRegion="polite">
                {error}
              </Text>
            ) : null}

            <TouchableOpacity
              style={[styles.primaryButton, saving && styles.disabledButton]}
              onPress={() => void agree()}
              disabled={saving}
              accessibilityRole="button"
              accessibilityState={{ disabled: saving, busy: saving }}
            >
              {saving ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={styles.primaryButtonText}>I agree</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => void signOut()}
              disabled={saving}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryButtonText}>Sign out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </TermsUpdateContext.Provider>
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
      maxWidth: 480,
      maxHeight: '90%',
      backgroundColor: t.colors.surface,
      borderRadius: 20,
      padding: Spacing.four,
    },
    scroll: {
      paddingBottom: 8,
    },
    icon: {
      alignSelf: 'center',
    },
    title: {
      fontSize: t.font(20),
      fontWeight: t.weight('800'),
      color: t.colors.textPrimary,
      marginTop: 10,
      marginBottom: 8,
      textAlign: 'center',
    },
    body: {
      fontSize: t.font(15),
      lineHeight: t.lineHeight(22),
      color: t.colors.textPrimary,
      marginBottom: 6,
    },
    bullet: {
      fontSize: t.font(15),
      lineHeight: t.lineHeight(22),
      color: t.colors.textSecondary,
      marginBottom: 6,
    },
    linkButton: {
      minHeight: 44,
      justifyContent: 'center',
      alignSelf: 'flex-start',
    },
    linkText: {
      color: t.colors.primary,
      fontWeight: t.weight('700'),
      fontSize: t.font(15),
    },
    section: {
      marginTop: 12,
    },
    sectionHeading: {
      fontSize: t.font(16),
      fontWeight: t.weight('700'),
      color: t.colors.textPrimary,
      marginBottom: 6,
    },
    paragraph: {
      fontSize: t.font(14),
      lineHeight: t.lineHeight(21),
      color: t.colors.textSecondary,
      marginBottom: 6,
    },
    error: {
      color: t.colors.dangerText,
      textAlign: 'center',
      marginTop: 8,
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
      fontSize: t.font(16),
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
