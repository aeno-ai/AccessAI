import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Speech from 'expo-speech';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/theme';
import type { Message } from '@/db/conversations';

type MessageBubbleProps = {
  message: Message;
};

/**
 * One message in the conversation, aligned by who "said" it — `sender:
 * 'me'` on the right (the person holding the phone), `'them'` on the left
 * (whoever they just handed it to). Every bubble can be read aloud via
 * real, offline-capable text-to-speech (`expo-speech`).
 */
export function MessageBubble({ message }: MessageBubbleProps) {
  const [speaking, setSpeaking] = useState(false);
  const isMe = message.sender === 'me';

  // If the bubble unmounts (e.g. leaving the screen) while still reading
  // aloud, stop rather than leaving speech running in the background.
  useEffect(() => {
    return () => {
      if (speaking) {
        void Speech.stop();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggleSpeak = () => {
    if (speaking) {
      void Speech.stop();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    Speech.speak(message.body, {
      onDone: () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  };

  return (
    <View style={[styles.row, isMe ? styles.rowMe : styles.rowThem]}>
      <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
        <Text style={[styles.body, isMe ? styles.bodyMe : styles.bodyThem]}>{message.body}</Text>
        <TouchableOpacity
          onPress={handleToggleSpeak}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={speaking ? 'Stop reading message aloud' : 'Read message aloud'}
          style={styles.speakButton}
        >
          <Ionicons
            name={speaking ? 'stop-circle-outline' : 'volume-medium-outline'}
            size={16}
            color={isMe ? 'rgba(255,255,255,0.85)' : colors.textMuted}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    gap: 6,
    maxWidth: '80%',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  bubbleMe: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    flexShrink: 1,
  },
  bodyMe: {
    color: colors.white,
  },
  bodyThem: {
    color: colors.textPrimary,
  },
  speakButton: {
    paddingBottom: 2,
  },
});
