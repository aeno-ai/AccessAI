import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLaya } from '@/laya/LayaProvider';
import { INTENTS, type IntentCategory, type IntentInfo } from '@/laya/catalog';
import { IconButton } from '@/components/ui/IconButton';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { usePreferences } from '@/hooks/use-preferences';
import { speakMixed } from '@/utils/speechHelper';
import { goBack } from '@/utils/navigation';

const CATEGORIES: IntentCategory[] = [
  'Emergency',
  'Go to',
  'Friends & messages',
  'Read aloud',
  'Conversation mode',
  'Learn',
  'Voice & text',
];

type Example = { en: string; fil?: string; screen?: string };

// A command that works on one screen only says which ("In Chats").
const examples = (category: IntentCategory): Example[] =>
  Object.values(INTENTS as Record<string, IntentInfo>)
    .filter((intent) => intent.category === category && intent.guide)
    .map((intent) => ({ ...intent.guide!, screen: intent.screen }));

/**
 * "What Laya can do": every command by category, in English and Filipino.
 * "Try" runs it through Laya — which still asks yes or no first.
 */
export default function LayaGuideScreen() {
  const { runText, enabled } = useLaya();
  const { prefs } = usePreferences();
  const styles = useThemedStyles(makeStyles);

  const readAll = () => {
    const text = CATEGORIES.map(
      (category) => `${category}: ${examples(category).map((example) => example.en).join('. ')}.`,
    ).join(' ');
    void speakMixed(`Here's what you can say. ${text}`, { rate: prefs.speechRate });
  };
  const readAllFilipino = () => {
    const text = CATEGORIES.flatMap((category) => examples(category).map((example) => example.fil).filter(Boolean)).join('. ');
    void speakMixed(`Ito ang mga puwede mong sabihin. ${text}.`, { rate: prefs.speechRate });
  };

  return (
    <ScreenShell maxWidth={MaxContentWidth.app}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <IconButton icon="arrow-back" label="Back" variant="tinted" onPress={() => goBack()} />
          <Text style={styles.title} accessibilityRole="header">
            What Laya can do
          </Text>
        </View>
        <Text style={styles.intro}>Laya is designed for people who are blind or have low vision.</Text>
        <Text style={styles.intro}>
          Start Laya with the Laya button, Magic Tap on iPhone, or by saying &quot;Hey Laya&quot;. Speak naturally — in
          English, Filipino or Taglish — Laya answers in the language you used. She says back what she understood and
          waits for yes or no. She never deletes your account, signs you out or removes friends by voice, and only works
          inside AccessAI. On any screen, ask &quot;What can I do here?&quot;.
        </Text>
        <Pressable style={styles.readAll} onPress={readAll} accessibilityRole="button">
          <Text style={styles.readAllText}>Read all of this aloud</Text>
        </Pressable>
        <Pressable style={styles.readAll} onPress={readAllFilipino} accessibilityRole="button" accessibilityLabel="Basahin nang malakas sa Filipino">
          <Text style={styles.readAllText}>Basahin sa Filipino</Text>
        </Pressable>
        {!enabled ? <Text style={styles.intro}>Laya is off. Turn it on in Settings → Laya to try these.</Text> : null}

        {CATEGORIES.map((category) => (
          <View key={category} style={styles.section}>
            <Text style={styles.sectionTitle} accessibilityRole="header">
              {category}
            </Text>
            {examples(category).map((example) => (
              <View key={example.en} style={styles.row}>
                <View style={styles.rowText}>
                  <Text style={styles.example}>“{example.en}”</Text>
                  {example.fil ? <Text style={styles.fil}>“{example.fil}”</Text> : null}
                  {example.screen ? <Text style={styles.fil}>In {example.screen}</Text> : null}
                </View>
                {enabled ? (
                  <View style={styles.tries}>
                    <Pressable
                      style={styles.try}
                      onPress={() => runText(example.en)}
                      accessibilityRole="button"
                      accessibilityLabel={`Try: ${example.en}`}
                    >
                      <Text style={styles.tryText}>Try</Text>
                    </Pressable>
                    {example.fil ? (
                      <Pressable
                        style={styles.try}
                        onPress={() => runText(example.fil!)}
                        accessibilityRole="button"
                        accessibilityLabel={`Subukan: ${example.fil}`}
                      >
                        <Text style={styles.tryText}>Subukan</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </ScreenShell>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    content: {
      padding: Spacing.four,
      paddingBottom: Spacing.six * 2,
      gap: Spacing.three,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    title: {
      flex: 1,
      fontSize: t.font(24),
      fontWeight: t.weight('900'),
      color: t.colors.textPrimary,
    },
    intro: {
      fontSize: t.font(15),
      lineHeight: t.lineHeight(22),
      color: t.colors.textSecondary,
    },
    readAll: {
      minHeight: 48,
      borderRadius: 24,
      borderWidth: 2,
      borderColor: t.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    readAllText: {
      fontSize: t.font(16),
      fontWeight: t.weight('800'),
      color: t.colors.primary,
    },
    section: {
      gap: 8,
    },
    sectionTitle: {
      fontSize: t.font(18),
      fontWeight: t.weight('800'),
      color: t.colors.textPrimary,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
    },
    rowText: {
      flex: 1,
      gap: 2,
    },
    example: {
      fontSize: t.font(16),
      fontWeight: t.weight('700'),
      color: t.colors.textPrimary,
    },
    fil: {
      fontSize: t.font(14),
      color: t.colors.textSecondary,
    },
    tries: {
      gap: 6,
    },
    try: {
      minWidth: 64,
      minHeight: 44,
      borderRadius: 22,
      backgroundColor: t.colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
    },
    tryText: {
      fontSize: t.font(15),
      fontWeight: t.weight('800'),
      color: t.colors.onPrimary,
    },
  });
