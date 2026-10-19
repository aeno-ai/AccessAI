import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useBigText } from '@/components/conversation/BigTextHost';
import { AppLogo } from '@/components/onboarding/Illustrations';
import { SosBanner } from '@/components/dashboard/SosBanner';
import { ActiveSosCards } from '@/components/sos/ActiveSosCards';
import { RecentSosCard } from '@/components/sos/RecentSosCard';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { TabHeader } from '@/components/ui/TabHeader';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { homeShortcuts, type ShortcutAction } from '@/constants/profiles';
import { getMessages, listConversations, type Conversation } from '@/db/conversations';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { useBootstrap } from '@/hooks/use-bootstrap';
import { usePreferences } from '@/hooks/use-preferences';
import { useScreenReader } from '@/hooks/use-screen-reader';
import { useTour } from '@/tutorial/TutorialProvider';
import { useTourTarget } from '@/tutorial/targets';
import { announce } from '@/utils/a11y';
import { keepIfSame } from '@/utils/cache';
import { openConversationFor, openSavedConversation } from '@/utils/conversationNav';
import { speakMixed } from '@/utils/speechHelper';

const RECENT_COUNT = 3;

function formatWhen(ms: number): string {
  return new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/**
 * Home, top to bottom: an SOS still going (if any); the past week's SOS,
 * ended ones too (RecentSosCard); the greeting card, the one way into a
 * conversation; "Start with…", four cards that each go somewhere
 * different (Big text, the sign camera, quick replies, Learn — plus "Read
 * last message" for Blind / low vision); the Emergency SOS button; and
 * the last few conversations. The first visit shows its tour.
 */
export default function HomeScreen() {
  const { role, firstName } = useBootstrap();
  const { prefs } = usePreferences();
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const screenReaderOn = useScreenReader();
  const bigText = useBigText();
  const [recent, setRecent] = useState<Conversation[]>([]);
  const greeting = firstName ? `Hello, ${firstName}!` : 'Hello!';
  const shortcuts = homeShortcuts(prefs.profile);
  const greetingTarget = useTourTarget('home.greeting');
  const cardsTarget = useTourTarget('home.cards');
  const sosTarget = useTourTarget('home.sos');
  const recentTarget = useTourTarget('home.recent');
  useTour('home');

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void listConversations().then(
        (rows) => !cancelled && setRecent((current) => keepIfSame(current, rows.slice(0, RECENT_COUNT))),
      );
      return () => {
        cancelled = true;
      };
    }, []),
  );

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
      case 'big-text':
        return bigText.show();
      case 'sign-camera':
        return router.push('/sign-camera' as Href);
      case 'quick-replies':
        return openConversationFor('replies');
      case 'learn':
        return router.navigate('/learn');
      case 'read-last':
        return void readLastMessage();
    }
  };

  return (
    <ScreenShell maxWidth={MaxContentWidth.app}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* The profile is in the menu (☰), so there's no profile button here. */}
        <TabHeader
          title="AccessAI, Home"
          menuTarget="home.menu"
          titleContent={
            <>
              <AppLogo size={28} decorative />
              <Text style={styles.wordmark}>AccessAI</Text>
            </>
          }
        />

        {/* An SOS that's still going (a friend's, or the user's own) comes first. */}
        <ActiveSosCards />
        {/* Then the past week's, ended ones too: when, where, how it ended. */}
        <RecentSosCard />

        <View ref={greetingTarget} collapsable={false}>
          <Pressable
            style={({ pressed }) => [styles.greetingCard, pressed && styles.pressed]}
            onPress={() => router.push('/conversation')}
            accessibilityRole="button"
            accessibilityLabel={`${greeting} Start a conversation`}
            accessibilityHint="Talk, type or sign with someone next to you"
          >
            <Text style={styles.greetingTitle}>{greeting}</Text>
            <Text style={styles.greetingSubtitle}>Talk with anyone — by voice, typing or sign language.</Text>
            <View style={styles.greetingAction}>
              <Text style={styles.greetingActionText}>Start a conversation</Text>
              <Ionicons name="arrow-forward" size={20} color={colors.primary} />
            </View>
          </Pressable>
        </View>

        {role !== 'non_pwd' ? (
          <View ref={sosTarget} collapsable={false}>
            <SosBanner />
          </View>
        ) : null}

        <View ref={cardsTarget} collapsable={false}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            Start with…
          </Text>
          <View style={styles.grid}>
            {shortcuts.map((shortcut) => (
              <Pressable
                key={shortcut.action}
                style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
                onPress={() => runShortcut(shortcut.action)}
                accessibilityRole="button"
                accessibilityLabel={shortcut.title}
                accessibilityHint={shortcut.description}
              >
                <View style={styles.tileIcon}>
                  <Ionicons name={shortcut.icon} size={24} color={colors.onPrimaryLight} />
                </View>
                <Text style={styles.tileTitle}>{shortcut.title}</Text>
                <Text style={styles.tileDescription}>{shortcut.description}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {recent.length ? (
          <View ref={recentTarget} collapsable={false}>
            <View style={styles.sectionRow}>
              <Text style={[styles.sectionTitle, styles.flex]} accessibilityRole="header">
                Recent conversations
              </Text>
              <Pressable
                style={styles.seeAll}
                onPress={() => router.push('/chats' as Href)}
                accessibilityRole="button"
                accessibilityLabel="See all conversations"
              >
                <Text style={styles.seeAllText}>See all</Text>
              </Pressable>
            </View>
            <View style={styles.recentCard}>
              {recent.map((conversation, index) => (
                <Pressable
                  key={conversation.id}
                  style={({ pressed }) => [styles.recentRow, index > 0 && styles.recentDivider, pressed && styles.pressed]}
                  onPress={() => openSavedConversation(conversation.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${conversation.title}. ${formatWhen(conversation.updatedAt)}`}
                  accessibilityHint="Opens the conversation"
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.primary} />
                  <View style={styles.flex}>
                    <Text style={styles.recentTitle} numberOfLines={1}>
                      {conversation.title}
                    </Text>
                    <Text style={styles.recentWhen}>{formatWhen(conversation.updatedAt)}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
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
    flex: {
      flex: 1,
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
      fontSize: t.font(24),
      fontWeight: t.weight('800'),
      color: t.colors.onPrimary,
    },
    greetingSubtitle: {
      fontSize: t.font(15),
      color: t.colors.onPrimary,
      marginTop: 6,
      lineHeight: t.lineHeight(21),
    },
    greetingAction: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      alignSelf: 'flex-start',
      marginTop: Spacing.three,
      minHeight: 48,
      paddingHorizontal: 20,
      borderRadius: 24,
      backgroundColor: t.colors.surface,
    },
    greetingActionText: {
      fontSize: t.font(16),
      fontWeight: t.weight('800'),
      color: t.colors.primary,
    },
    sectionTitle: {
      fontSize: t.font(17),
      fontWeight: t.weight('800'),
      color: t.colors.textPrimary,
      marginBottom: 10,
    },
    sectionRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    seeAll: {
      minHeight: 44,
      minWidth: 44,
      paddingHorizontal: 8,
      justifyContent: 'center',
      marginBottom: 10,
    },
    seeAllText: {
      fontSize: t.font(15),
      fontWeight: t.weight('700'),
      color: t.colors.primary,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
    },
    tile: {
      flexBasis: '45%',
      flexGrow: 1,
      minHeight: 120,
      padding: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
    },
    tileIcon: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: t.colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    tileTitle: {
      fontSize: t.font(16),
      fontWeight: t.weight('800'),
      color: t.colors.textPrimary,
    },
    tileDescription: {
      marginTop: 2,
      fontSize: t.font(13),
      lineHeight: t.lineHeight(18),
      color: t.colors.textSecondary,
    },
    recentCard: {
      borderWidth: 1,
      borderColor: t.colors.border,
      borderRadius: 14,
      backgroundColor: t.colors.surface,
      overflow: 'hidden',
    },
    recentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 60,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    recentDivider: {
      borderTopWidth: 1,
      borderTopColor: t.colors.border,
    },
    recentTitle: {
      fontSize: t.font(15),
      fontWeight: t.weight('700'),
      color: t.colors.textPrimary,
    },
    recentWhen: {
      marginTop: 2,
      fontSize: t.font(12),
      color: t.colors.textMuted,
    },
    pressed: {
      opacity: 0.75,
    },
  });
