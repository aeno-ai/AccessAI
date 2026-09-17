import { useEffect, useState } from 'react';
import { Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '@/api/apiClient';
import { colors, Spacing } from '@/constants/theme';
import { DEFAULT_SOS_MESSAGE } from '@/constants/dashboard';

type SosModalProps = {
  visible: boolean;
  onClose: () => void;
};

type Coordinates = { latitude: number; longitude: number };

type Status = 'locating' | 'ready' | 'sending' | 'sent' | 'error';

function fillDefaultMessage(coords: Coordinates | null): string {
  const locationText = coords
    ? `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`
    : 'my current location';
  return DEFAULT_SOS_MESSAGE.replace('{location}', locationText);
}

/**
 * The SOS confirmation sheet: captures GPS (works offline — it reads the
 * device's own GPS chip, no network needed), pre-fills the default message,
 * and lets the user edit it before sending. Submits to the existing, already
 * working `POST /sos/trigger` endpoint. Contact-to-account linking and actual
 * notification delivery are a separate, deferred backend task — this only
 * covers the trigger itself.
 */
export function SosModal({ visible, onClose }: SosModalProps) {
  const [status, setStatus] = useState<Status>('locating');
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [message, setMessage] = useState(DEFAULT_SOS_MESSAGE.replace('{location}', 'my current location'));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) {
      return;
    }

    let cancelled = false;

    async function locate() {
      setStatus('locating');
      setError('');
      try {
        const { granted } = await Location.requestForegroundPermissionsAsync();
        if (!granted) {
          if (!cancelled) {
            setMessage(fillDefaultMessage(null));
            setStatus('ready');
          }
          return;
        }
        const position = await Location.getCurrentPositionAsync({});
        if (cancelled) {
          return;
        }
        const nextCoords = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        setCoords(nextCoords);
        setMessage(fillDefaultMessage(nextCoords));
        setStatus('ready');
      } catch {
        if (!cancelled) {
          setMessage(fillDefaultMessage(null));
          setStatus('ready');
        }
      }
    }

    void locate();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const handleSend = async () => {
    setStatus('sending');
    setError('');
    try {
      await apiFetch('/sos/trigger', {
        method: 'POST',
        body: JSON.stringify({
          triggerMethod: 'app-hold-confirm',
          location: coords ?? undefined,
          message,
        }),
      });
      setStatus('sent');
    } catch (e: unknown) {
      setStatus('ready');
      setError(e instanceof Error ? e.message : 'Could not send SOS. Please try again.');
    }
  };

  const handleClose = () => {
    onClose();
    // Reset for next time, after the close animation has a moment to run.
    setTimeout(() => {
      setStatus('locating');
      setCoords(null);
      setError('');
    }, 300);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {status === 'sent' ? (
            <>
              <Ionicons name="checkmark-circle-outline" size={40} color={colors.primary} />
              <Text style={styles.title}>SOS sent</Text>
              <Text style={styles.subtitle}>Your emergency contacts have been notified.</Text>
              <TouchableOpacity style={styles.primaryButton} onPress={handleClose} accessibilityRole="button">
                <Text style={styles.primaryButtonText}>Done</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Ionicons name="alert-circle-outline" size={32} color={colors.error} />
              <Text style={styles.title}>Send Emergency SOS</Text>
              <Text style={styles.subtitle}>
                {status === 'locating'
                  ? 'Getting your location…'
                  : 'Review the message below, then send.'}
              </Text>
              <TextInput
                style={styles.input}
                value={message}
                onChangeText={setMessage}
                multiline
                editable={status !== 'sending'}
                accessibilityLabel="SOS message"
              />
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <View style={styles.actionsRow}>
                <TouchableOpacity style={styles.secondaryButton} onPress={handleClose} accessibilityRole="button">
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryButton, styles.sendButton, status === 'sending' && styles.disabledButton]}
                  onPress={() => void handleSend()}
                  disabled={status === 'sending'}
                  accessibilityRole="button"
                >
                  <Text style={styles.primaryButtonText}>
                    {status === 'sending' ? 'Sending…' : 'Send SOS'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(20, 16, 36, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: Spacing.four,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    marginTop: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 6,
    textAlign: 'center',
  },
  input: {
    width: '100%',
    minHeight: 80,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
    fontSize: 14,
    color: colors.textPrimary,
    textAlignVertical: 'top',
  },
  errorText: {
    color: colors.error,
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
    width: '100%',
  },
  primaryButton: {
    backgroundColor: colors.error,
    borderRadius: 24,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  sendButton: {
    flex: 1,
  },
  disabledButton: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
  secondaryButton: {
    flex: 1,
    borderRadius: 24,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.textSecondary,
    fontWeight: '700',
    fontSize: 14,
  },
});
