import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { DrawerToggleButton } from 'expo-router/drawer';
import { Ionicons } from '@expo/vector-icons';
import { BigTextCard } from '@/components/conversation/BigTextCard';
import { AppLogo } from '@/components/onboarding/Illustrations';
import { FeatureTile } from '@/components/dashboard/FeatureTile';
import { SosBanner } from '@/components/dashboard/SosBanner';
import { ActiveSosCards } from '@/components/sos/ActiveSosCards';
import { IconButton } from '@/components/ui/IconButton';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { DASHBOARD_FEATURES } from '@/constants/dashboard';
import { PROFILE_SHORTCUTS, type ConversationAction, type ShortcutAction } from '@/constants/profiles';
import { getMessages, listConversations } from '@/db/conversations';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { useBootstrap } from '@/hooks/use-bootstrap';
import { usePreferences } from '@/hooks/use-preferences';
import { useScreenReader } from '@/hooks/use-screen-reader';
import { announce } from '@/utils/a11y';
import { speakMixed } from '@/utils/speechHelper';

function openConversation(action?: ConversationAction) {
  router.push(
    action
      ? // A fresh `opened` each tap, so the same shortcut works every time.
        { pathname: '/conversation', params: { action, opened: String(Date.now()) } }
      : '/conversation',
  );
}

export default function HomeScreen() {
  const { role, firstName } = useBootstrap();
  const { prefs, setPref } = usePreferences();
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const screenReaderOn = useScreenReader();
  const [showBig, setShowBig] = useState(false);
  const greeting = firstName ? `Hello, ${firstName}!` : 'Hello!';
  const shortcuts = PROFILE_SHORTCUTS[prefs.profile];

  // Reads the newest message saved on this phone — handy after putting the
  // phone down mid-conversation.
  const readLastMessage = async () => {
    const [latest] = await listConversations();
    const messages = latest ? await getMessages(latest.id) : [];
    const last = messages[messages.length - 1];
    const text = last
      ? `${last.sender === 'me' ? 'You' : 'Them'} said: ${last.body}`
      : 'There are no messages yet.';
    if (screenReaderOn) {
      announce(text);
    } else {
      void speakMixed(text, { rate: prefs.speechRate });
    }
  };

  const runShortcut = (action: ShortcutAction) => {
    switch (action) {
      case 'talk':
        return openConversation('listen');
      case 'captions':
        return openConversation('captions');
      case 'sign':
        return openConversation('sign');
      case 'show':
        return setShowBig(true);
      case 'read-last':
        return void readLastMessage();
      case 'quick-replies':
        if (!prefs.showQuickReplies) setPref('showQuickReplies', true);
        return openConversation();
      case 'type-to-speak':
        if (!prefs.speakMyMessages) {
          setPref('speakMyMessages', true);
          announce('Your messages will be spoken aloud.');
        }
        return openConversation('type');
    }
  };

  return (
    <ScreenShell maxWidth={MaxContentWidth.app}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerSide}>
            <DrawerToggleButton tintColor={colors.textPrimary} accessibilityLabel="Open menu" />
          </View>
          <View style={styles.wordmarkRow} accessible accessibilityRole="header" accessibilityLabel="PDAccessAI">
            <AppLogo size={28} decorative />
            <Text style={styles.wordmark}>PDAccessAI</Text>
          </View>
          <IconButton
            icon="person-circle-outline"
            label="Edit profile"
            variant="tinted"
            iconSize={26}
            onPress={() => router.push('/profile')}
          />
        </View>

        {/* An SOS that's still going (a friend's, or the user's own) comes first. */}
        <ActiveSosCards />

        <Pressable
          style={styles.greetingCard}
          onPress={() => openConversation()}
          accessibilityRole="button"
          accessibilityLabel={`${greeting} Start a conversation`}
        >
          <Text style={styles.greetingTitle}>{greeting}</Text>
          <Text style={styles.greetingSubtitle}>
            What kind of conversation do you need help with right now?
          </Text>
          <View style={styles.pillRow}>
            <View style={styles.pill}>
              <Text style={styles.pillText}>STT</Text>
            </View>
            <View style={styles.pill}>
              <Text style={styles.pillText}>TTS</Text>
            </View>
            <View style={styles.pill}>
              <Text style={styles.pillText}>Sign Language Recognition</Text>
            </View>
          </View>
        </Pressable>

        {shortcuts.length > 0 ? (
          <View>
            <Text style={[styles.sectionTitle, styles.forYouTitle]} accessibilityRole="header">
              For you
            </Text>
            <View style={styles.shortcutRow}>
              {shortcuts.map((shortcut) => (
                <Pressable
                  key={shortcut.action}
                  style={({ pressed }) => [styles.shortcut, pressed && styles.pressed]}
                  onPress={() => runShortcut(shortcut.action)}
                  accessibilityRole="button"
                  accessibilityLabel={`${shortcut.title}. ${shortcut.description}`}
                >
                  <View style={styles.shortcutIcon}>
                    <Ionicons name={shortcut.icon} size={24} color={colors.onPrimaryLight} />
                  </View>
                  <Text style={styles.shortcutTitle}>{shortcut.title}</Text>
                  <Text style={styles.shortcutDescription}>{shortcut.description}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            Core AI Features
          </Text>
          <Text style={styles.sectionHint}>available in every conversation</Text>
        </View>
        <View style={styles.grid}>
          {DASHBOARD_FEATURES.map((feature) => (
            <FeatureTile
              key={feature.id}
              icon={feature.icon}
              title={feature.title}
              description={feature.description}
            />
          ))}
        </View>

        {/* SOS is for PWD accounts only (the backend refuses it for non-PWD
            too). Hidden only when the role is known to be non-PWD: if it's
            ever unknown, an emergency button shouldn't silently vanish. */}
        {role !== 'non_pwd' ? <SosBanner /> : null}

        <TouchableOpacity
          style={styles.aiBanner}
          onPress={() => openConversation()}
          accessibilityRole="button"
          accessibilityLabel="Start AI Conversation Mode. Speech to text, text to speech and sign language combined."
          activeOpacity={0.85}
        >
          <View style={styles.aiBannerIcon}>
            <Ionicons name="sync-outline" size={20} color={colors.onBanner} />
          </View>
          <View style={styles.aiBannerText}>
            <Text style={styles.aiBannerTitle}>AI Conversation Mode</Text>
            <Text style={styles.aiBannerSubtitle}>
              STT + TTS + Sign Language combined — talk both ways, seamlessly.
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={20} color={colors.onBanner} />
        </TouchableOpacity>
      </ScrollView>
      <BigTextCard visible={showBig} onClose={() => setShowBig(false)} />
    </ScreenShell>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    scrollContent: {
      paddingHorizontal: Spacing.four,
      paddingTop: Spacing.three,
      paddingBottom: Spacing.six,
      gap: Spacing.four,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerSide: {
      minWidth: 48,
      minHeight: 48,
      justifyContent: 'center',
    },
    wordmarkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    wordmark: {
      fontSize: t.font(16),
      fontWeight: t.weight('800'),
      color: t.colors.textPrimary,
    },
    greetingCard: {
      backgroundColor: t.colors.primary,
      borderRadius: 20,
      padding: Spacing.four,
    },
    greetingTitle: {
      fontSize: t.font(22),
      fontWeight: t.weight('800'),
      color: t.colors.onPrimary,
    },
    greetingSubtitle: {
      fontSize: t.font(13),
      color: t.colors.onPrimary,
      opacity: 0.92,
      marginTop: 6,
      lineHeight: t.lineHeight(18),
    },
    pillRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 14,
    },
    pill: {
      borderWidth: 1,
      borderColor: t.colors.onPrimary,
      borderRadius: 999,
      paddingVertical: 4,
      paddingHorizontal: 10,
    },
    pillText: {
      color: t.colors.onPrimary,
      fontSize: t.font(11),
      fontWeight: t.weight('700'),
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: 4,
      marginTop: Spacing.two,
    },
    sectionTitle: {
      fontSize: t.font(15),
      fontWeight: t.weight('800'),
      color: t.colors.textPrimary,
    },
    sectionHint: {
      fontSize: t.font(12),
      color: t.colors.textMuted,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    forYouTitle: {
      marginBottom: 10,
    },
    shortcutRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    shortcut: {
      flexBasis: '30%',
      flexGrow: 1,
      minWidth: 140,
      minHeight: 112,
      padding: 14,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: t.colors.primary,
      backgroundColor: t.colors.surface,
    },
    shortcutIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: t.colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    shortcutTitle: {
      fontSize: t.font(16),
      fontWeight: t.weight('800'),
      color: t.colors.textPrimary,
    },
    shortcutDescription: {
      marginTop: 2,
      fontSize: t.font(13),
      lineHeight: t.lineHeight(18),
      color: t.colors.textSecondary,
    },
    pressed: {
      opacity: 0.75,
    },
    aiBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.colors.banner,
      borderRadius: 16,
      padding: 14,
      minHeight: 56,
    },
    aiBannerIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: t.colors.onBanner,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    aiBannerText: {
      flex: 1,
      marginRight: 10,
    },
    aiBannerTitle: {
      fontSize: t.font(14),
      fontWeight: t.weight('800'),
      color: t.colors.onBanner,
      marginBottom: 2,
    },
    aiBannerSubtitle: {
      fontSize: t.font(11),
      color: t.colors.onBanner,
      opacity: 0.9,
      lineHeight: t.lineHeight(15),
    },
  });
