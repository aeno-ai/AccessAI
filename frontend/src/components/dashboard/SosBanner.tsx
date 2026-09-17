import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/theme';
import { SosModal } from './SosModal';

const HOLD_DURATION_MS = 600;

/**
 * The red Emergency SOS banner. "Send" requires a hold rather than a single
 * tap, so a stray touch can't fire an emergency alert by accident — holding
 * it opens the SosModal, where the message is reviewed/edited and sent
 * explicitly.
 */
export function SosBanner() {
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <View style={styles.banner}>
      <View style={styles.iconBox}>
        <Ionicons name="warning-outline" size={20} color={colors.white} />
      </View>
      <View style={styles.textColumn}>
        <Text style={styles.title}>Emergency SOS</Text>
        <Text style={styles.subtitle}>Send your GPS location to emergency contacts instantly.</Text>
      </View>
      <Pressable
        style={styles.sendButton}
        onLongPress={() => setModalVisible(true)}
        delayLongPress={HOLD_DURATION_MS}
        accessibilityRole="button"
        accessibilityLabel="Hold to send SOS"
        accessibilityHint="Press and hold to open the SOS confirmation"
      >
        <Text style={styles.sendButtonText}>Hold to Send</Text>
      </Pressable>
      <SosModal visible={modalVisible} onClose={() => setModalVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.error,
    borderRadius: 16,
    padding: 14,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textColumn: {
    flex: 1,
    marginRight: 10,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.white,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 15,
  },
  sendButton: {
    backgroundColor: colors.white,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  sendButtonText: {
    color: colors.error,
    fontWeight: '800',
    fontSize: 12,
  },
});
