import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { usePreferences } from '@/hooks/use-preferences';
import { speakMixed, stopMixed } from '@/utils/speechHelper';

type MessageBubbleProps = {
  body: string;
  /** 'me' is drawn on the right, 'them' on the left. */
  sender: 'me' | 'them';
  createdAt: number;
  /** How the sender is named to screen readers, e.g. "You", "Them", "Ana". */
  senderName: string;
  /** Optional line under the text, e.g. "Waiting for internet". */
  status?: string;
  /** Press and hold (or the screen-reader action): show it full-screen. */
  onShowBig?: () => void;
};

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/**
 * One message, aligned by who "said" it. Every bubble can be read aloud via
 * offline-capable text-to-speech (`expo-speech`), switching between English
 * and Filipino voices clause by clause for Taglish — see
 * `utils/speechHelper.ts`.
 *
 * Screen readers get the whole bubble as one item ("Them said: …, 3:42 PM")
 * with "Read aloud" as its action, instead of the text and a tiny speaker
 * button as two separate stops.
 */
export function MessageBubble({ body, sender, createdAt, senderName, status, onShowBig }: MessageBubbleProps) {
  const { prefs } = usePreferences();
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const [speaking, setSpeaking] = useState(false);
  const speakingRef = useRef(false);
  const isMe = sender === 'me';

  // If the bubble unmounts (e.g. leaving the screen) while still reading
  // aloud, stop rather than leaving speech running in the background.
  useEffect(() => {
    return () => {
      if (speakingRef.current) {
        stopMixed();
      }
    };
  }, []);

  const toggleSpeak = () => {
    if (speaking) {
      stopMixed();
      speakingRef.current = false;
      setSpeaking(false);
      return;
    }
    speakingRef.current = true;
    setSpeaking(true);
    const done = () => {
      speakingRef.current = false;
      setSpeaking(false);
    };
    void speakMixed(body, { rate: prefs.speechRate, onDone: done, onError: done });
  };

  const time = formatTime(createdAt);
  const spoken = `${senderName} said: ${body}. ${time}${status ? `. ${status}` : ''}`;

  return (
    <View style={[styles.row, isMe ? styles.rowMe : styles.rowThem]}>
      <Pressable
        style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}
        onLongPress={onShowBig}
        accessible
        accessibilityLabel={spoken}
        accessibilityActions={[
          { name: 'activate', label: speaking ? 'Stop reading aloud' : 'Read aloud' },
          ...(onShowBig ? [{ name: 'showBig', label: 'Show on screen' }] : []),
        ]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'activate') toggleSpeak();
          if (event.nativeEvent.actionName === 'showBig') onShowBig?.();
        }}
      >
        <View style={styles.textColumn}>
          <Text style={[styles.body, isMe ? styles.bodyMe : styles.bodyThem]}>{body}</Text>
          <Text style={[styles.meta, isMe ? styles.metaMe : styles.metaThem]}>
            {status ? `${time} · ${status}` : time}
          </Text>
        </View>
        <Pressable
          onPress={toggleSpeak}
          style={styles.speakButton}
          hitSlop={8}
          accessible={false}
          importantForAccessibility="no"
        >
          <Ionicons
            name={speaking ? 'stop-circle-outline' : 'volume-medium-outline'}
            size={20}
            color={isMe ? colors.onBubbleMe : colors.textSecondary}
          />
        </Pressable>
      </Pressable>
    </View>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      marginBottom: 10,
    },
    rowMe: {
      justifyContent: 'flex-end',
    },
    rowThem: {
      justifyContent: 'flex-start',
    },
    bubble: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: 4,
      maxWidth: '85%',
      borderRadius: 16,
      paddingVertical: 8,
      paddingLeft: 12,
      paddingRight: 4,
    },
    bubbleMe: {
      backgroundColor: t.colors.bubbleMe,
      borderBottomRightRadius: 4,
    },
    bubbleThem: {
      backgroundColor: t.colors.bubbleThem,
      borderWidth: 1,
      borderColor: t.colors.border,
      borderBottomLeftRadius: 4,
    },
    textColumn: {
      flexShrink: 1,
      paddingVertical: 2,
    },
    body: {
      fontSize: t.font(15),
      lineHeight: t.lineHeight(21),
      fontWeight: t.weight('400'),
    },
    bodyMe: {
      color: t.colors.onBubbleMe,
    },
    bodyThem: {
      color: t.colors.onBubbleThem,
    },
    meta: {
      marginTop: 2,
      fontSize: t.font(11),
    },
    metaMe: {
      color: t.colors.onBubbleMe,
      opacity: 0.85,
    },
    metaThem: {
      color: t.colors.textSecondary,
    },
    // 40×40 visually inside the bubble; the bubble itself is the screen
    // reader's target, so this only serves touch.
    speakButton: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
