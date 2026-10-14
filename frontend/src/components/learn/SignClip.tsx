import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { requireOptionalNativeModule, useEvent } from 'expo';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import type { ClipSource } from '@/learn/types';

/**
 * A sign's recorded clip (assets/signs/), played on the phone: muted, again
 * and again, with a Replay button and 0.5× slow motion. The clips come with
 * the app, so they also play offline.
 *
 * The video player is a native part. Clips show once the app is built with
 * it (it's in Expo Go already); until then — or while a clip isn't recorded
 * yet — this shows a short note instead of crashing.
 */
const ExpoVideo = requireOptionalNativeModule('ExpoVideo')
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('expo-video') as typeof import('expo-video'))
  : null;

/** Whether this version of the app can play clips at all. */
export const clipPlayerInApp = ExpoVideo !== null;

type Props = {
  /** The clip, or null while it isn't recorded yet. */
  source: ClipSource | null;
  /** What it shows, for screen readers: "the sign for Thank you", or "a sign" in a quiz. */
  label: string;
};

export function SignClip({ source, label }: Props) {
  const [slow, setSlow] = useState(false);
  if (source === null || !ExpoVideo) {
    return <ClipNote text={source === null ? 'Clip coming soon.' : "Videos can't play in this version of the app yet."} />;
  }
  // Switching speed starts a fresh player at that speed (from the start of the sign).
  return (
    <ClipPlayer
      key={slow ? 'slow' : 'normal'}
      source={source}
      label={label}
      video={ExpoVideo}
      slow={slow}
      onToggleSlow={() => setSlow(!slow)}
    />
  );
}

function ClipNote({ text }: { text: string }) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.frame, styles.placeholder]} accessible accessibilityLabel={text}>
      <Ionicons name="videocam-off-outline" size={32} color={colors.textSecondary} />
      <Text style={styles.placeholderText}>{text}</Text>
    </View>
  );
}

type PlayerProps = {
  source: ClipSource;
  label: string;
  video: typeof import('expo-video');
  slow: boolean;
  onToggleSlow: () => void;
};

function ClipPlayer({ source, label, video, slow, onToggleSlow }: PlayerProps) {
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  // A new clip makes a new player (one per screen, so the phone isn't playing several).
  const player = video.useVideoPlayer(source, (p) => {
    p.loop = true;
    p.muted = true;
    p.playbackRate = slow ? 0.5 : 1;
    p.play();
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });

  if (status === 'error') return <ClipNote text="This clip can't play right now." />;

  return (
    <View style={styles.wrap}>
      <View style={styles.frame} accessible accessibilityRole="image" accessibilityLabel={`Video of ${label}`}>
        <View style={StyleSheet.absoluteFill} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <video.VideoView player={player} style={styles.video} contentFit="contain" nativeControls={false} />
        </View>
      </View>
      <View style={styles.controls}>
        <Pressable
          style={styles.control}
          onPress={() => player.replay()}
          accessibilityRole="button"
          accessibilityLabel="Play the sign again"
        >
          <Ionicons name="refresh" size={18} color={colors.primary} />
          <Text style={styles.controlText}>Replay</Text>
        </Pressable>
        <Pressable
          style={[styles.control, slow && styles.controlOn]}
          onPress={onToggleSlow}
          accessibilityRole="switch"
          accessibilityState={{ checked: slow }}
          accessibilityLabel="Slow motion"
        >
          <Ionicons name="speedometer-outline" size={18} color={slow ? colors.onPrimary : colors.primary} />
          <Text style={[styles.controlText, slow && styles.controlTextOn]}>{slow ? '0.5×' : '1×'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    wrap: {
      gap: 8,
    },
    frame: {
      width: '100%',
      aspectRatio: 16 / 9,
      borderRadius: 14,
      overflow: 'hidden',
      backgroundColor: '#000000',
    },
    video: {
      flex: 1,
    },
    placeholder: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      padding: 16,
      backgroundColor: t.colors.surfaceAlt,
      borderWidth: 1,
      borderColor: t.colors.border,
    },
    placeholderText: {
      fontSize: t.font(15),
      fontWeight: t.weight('600'),
      color: t.colors.textSecondary,
      textAlign: 'center',
    },
    controls: {
      flexDirection: 'row',
      gap: 8,
    },
    control: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      minHeight: 44,
      paddingHorizontal: 14,
      borderRadius: 22,
      borderWidth: 1.5,
      borderColor: t.colors.primary,
    },
    controlOn: {
      backgroundColor: t.colors.primary,
    },
    controlText: {
      fontSize: t.font(14),
      fontWeight: t.weight('700'),
      color: t.colors.primary,
    },
    controlTextOn: {
      color: t.colors.onPrimary,
    },
  });
