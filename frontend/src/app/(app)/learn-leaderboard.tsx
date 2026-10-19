import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '@/api/apiClient';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { ScreenShell } from '@/components/ui/ScreenShell';
import { MaxContentWidth } from '@/constants/theme';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { useLearn } from '@/learn/LearnProvider';

type Row = { userId: string; name: string; lessons: number; me: boolean };

const lessonsText = (n: number) => `${n} lesson${n === 1 ? '' : 's'}`;

/**
 * How many different lessons you and your friends finished this week (the
 * week starts Monday; doing one again doesn't count twice). Needs the
 * internet. Learn keeps no points (HANDOFF.md §38).
 */
export default function LeaderboardScreen() {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const { sync } = useLearn();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await sync(); // your newest lessons count too
      const data = await apiFetch<{ rows: Row[] }>('/learn/leaderboard');
      setRows(data.rows);
      setError(null);
    } catch {
      setError('The leaderboard needs the internet. Try again when you are online.');
    } finally {
      setLoading(false);
    }
  }, [sync]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <ScreenShell maxWidth={MaxContentWidth.app}>
      <ScreenHeader title="This week" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
      >
        <Text style={styles.note}>Lessons you and your friends finished since Monday.</Text>
        {error ? <Text style={styles.note}>{error}</Text> : null}
        {rows && rows.length <= 1 ? <Text style={styles.note}>Add friends to learn together and see who finishes the most.</Text> : null}
        {rows?.map((row, index) => (
          <View
            key={row.userId}
            style={[styles.row, row.me && styles.rowMe]}
            accessible
            accessibilityLabel={`Number ${index + 1}: ${row.me ? 'You' : row.name}, ${lessonsText(row.lessons)}`}
          >
            <Text style={styles.rank}>{index + 1}</Text>
            {index === 0 && row.lessons > 0 ? <Ionicons name="trophy" size={22} color={colors.primary} /> : null}
            <Text style={styles.name}>{row.me ? 'You' : row.name}</Text>
            <Text style={styles.count}>{lessonsText(row.lessons)}</Text>
          </View>
        ))}
      </ScrollView>
    </ScreenShell>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    content: {
      gap: 10,
      padding: 16,
    },
    note: {
      fontSize: t.font(15),
      color: t.colors.textSecondary,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: 56,
      paddingHorizontal: 14,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
    },
    rowMe: {
      borderWidth: 2,
      borderColor: t.colors.primary,
      backgroundColor: t.colors.primaryLight,
    },
    rank: {
      width: 28,
      fontSize: t.font(18),
      fontWeight: t.weight('800'),
      color: t.colors.textPrimary,
    },
    name: {
      flex: 1,
      fontSize: t.font(17),
      fontWeight: t.weight('700'),
      color: t.colors.textPrimary,
    },
    count: {
      fontSize: t.font(16),
      fontWeight: t.weight('800'),
      color: t.colors.textPrimary,
    },
  });
