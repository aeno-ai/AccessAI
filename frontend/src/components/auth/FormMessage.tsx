import { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { announce } from '@/utils/a11y';

type Props = {
  error?: string;
  notice?: string;
};

/**
 * The error or notice under a form. Read aloud as soon as it appears —
 * Android's live region alone doesn't reach VoiceOver on iPhone.
 */
export function FormMessage({ error = '', notice = '' }: Props) {
  const styles = useThemedStyles(makeStyles);

  useEffect(() => {
    if (error) announce(error);
  }, [error]);
  useEffect(() => {
    if (notice) announce(notice);
  }, [notice]);

  return (
    <>
      {notice ? (
        <Text style={styles.notice} accessibilityLiveRegion="polite">
          {notice}
        </Text>
      ) : null}
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    notice: {
      color: t.colors.textSecondary,
      fontSize: t.font(14),
      textAlign: 'center',
      marginBottom: 12,
    },
    error: {
      color: t.colors.dangerText,
      fontSize: t.font(14),
      fontWeight: t.weight('600'),
      textAlign: 'center',
      marginBottom: 12,
    },
  });
