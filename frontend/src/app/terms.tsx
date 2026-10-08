import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { TERMS_INTRO, TERMS_SECTIONS, termsLastUpdated } from '@/constants/legal';
import { formatLongDate } from '@/utils/dates';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';

/**
 * Terms of Use & Privacy Notice. Lives at the root of app/, outside the
 * logged-in / logged-out guards in _layout.tsx, so both Register and
 * Settings can open it.
 */
export default function TermsScreen() {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <ScreenShell maxWidth={MaxContentWidth.app}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={goBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title} accessibilityRole="header">
          Terms of Use & Privacy Notice
        </Text>
        <Text style={styles.updated}>Last updated {formatLongDate(termsLastUpdated())}</Text>
        <Text style={styles.paragraph}>{TERMS_INTRO}</Text>

        {TERMS_SECTIONS.map((section) => (
          <View key={section.heading} style={styles.section}>
            <Text style={styles.heading} accessibilityRole="header">
              {section.heading}
            </Text>
            {section.blocks.map((block, index) =>
              typeof block === 'string' ? (
                <Text key={index} style={styles.paragraph}>
                  {block}
                </Text>
              ) : (
                <View key={index} style={styles.list}>
                  {block.map((item) => (
                    <View key={item} style={styles.bulletRow}>
                      <Text style={styles.bullet}>{'•'}</Text>
                      <Text style={styles.bulletText}>{item}</Text>
                    </View>
                  ))}
                </View>
              ),
            )}
          </View>
        ))}
      </ScrollView>
    </ScreenShell>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    header: {
      paddingHorizontal: Spacing.three,
      paddingTop: Spacing.two,
    },
    backButton: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      minHeight: 48,
      paddingRight: Spacing.three,
    },
    backText: {
      color: t.colors.primary,
      fontSize: t.font(16),
      fontWeight: t.weight('600'),
    },
    content: {
      paddingHorizontal: Spacing.four,
      paddingBottom: Spacing.five,
    },
    title: {
      fontSize: t.font(24),
      fontWeight: t.weight('800'),
      color: t.colors.textPrimary,
      marginTop: Spacing.two,
    },
    updated: {
      fontSize: t.font(13),
      color: t.colors.textSecondary,
      marginTop: 4,
      marginBottom: Spacing.three,
    },
    section: {
      marginTop: Spacing.four,
    },
    heading: {
      fontSize: t.font(17),
      fontWeight: t.weight('700'),
      color: t.colors.textPrimary,
      marginBottom: Spacing.two,
    },
    paragraph: {
      fontSize: t.font(15),
      lineHeight: t.lineHeight(22),
      color: t.colors.textPrimary,
      marginBottom: Spacing.two,
    },
    list: {
      marginBottom: Spacing.two,
    },
    bulletRow: {
      flexDirection: 'row',
      marginBottom: 6,
    },
    bullet: {
      width: 18,
      fontSize: t.font(15),
      lineHeight: t.lineHeight(22),
      color: t.colors.primary,
    },
    bulletText: {
      flex: 1,
      fontSize: t.font(15),
      lineHeight: t.lineHeight(22),
      color: t.colors.textPrimary,
    },
  });
