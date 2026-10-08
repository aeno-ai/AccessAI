import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Platform, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { apiFetch } from '@/api/apiClient';
import { PrimaryButton } from '@/components/auth/PrimaryButton';
import { QrCode } from '@/components/friends/QrCode';
import { IconButton } from '@/components/ui/IconButton';
import { SectionHeader } from '@/components/ui/SettingRow';
import { Spacing } from '@/constants/theme';
import { useAppTheme, useThemedStyles, type AppTheme } from '@/hooks/use-app-theme';
import { useIsOnline } from '@/hooks/use-is-online';
import { useFriends } from '@/realtime/FriendsProvider';
import { announce } from '@/utils/a11y';

// What the QR code holds. Anything ending in a code also works when scanned.
const QR_PREFIX = 'PDACCESSAI-FRIEND:';

/** "abcd 2345", "ABCD2345" or a scanned QR → "ABCD-2345", or null. */
function extractCode(text: string): string | null {
  const match = text.toUpperCase().match(/([A-Z0-9]{4})[\s-]?([A-Z0-9]{4})\s*$/);
  return match ? `${match[1]}-${match[2]}` : null;
}

/** Read out one character at a time, so a screen reader doesn't try to say it as a word. */
const spellOut = (code: string) => code.replace('-', '').split('').join(' ').replace(/^(\S \S \S \S) /, '$1, ');

type Result = { kind: 'success' | 'error'; text: string };

/**
 * Connecting with someone: show them your code (or its QR), or enter or scan
 * theirs. There's no searching by name or email, so nobody can find you
 * unless you share your code.
 */
export default function AddFriendScreen() {
  const { friendCode, refresh } = useFriends();
  const { colors } = useAppTheme();
  const styles = useThemedStyles(makeStyles);
  const online = useIsOnline();
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [scanning, setScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const scanned = useRef(false);

  const send = async (raw: string) => {
    const parsed = extractCode(raw);
    if (!parsed) {
      const text = 'A friend code has 8 letters and numbers, like ABCD-2345.';
      setResult({ kind: 'error', text });
      announce(text);
      return;
    }
    setSending(true);
    setResult(null);
    try {
      const data = await apiFetch<{ status: 'pending' | 'accepted'; person: { firstName: string; name: string } }>(
        '/friends/requests',
        { method: 'POST', body: JSON.stringify({ code: parsed }) },
      );
      const who = data.person.firstName || data.person.name;
      const text =
        data.status === 'accepted'
          ? `You and ${who} are now friends.`
          : `Request sent to ${who}. You'll be friends once they accept.`;
      setResult({ kind: 'success', text });
      announce(text);
      setCode('');
      void refresh();
    } catch (e: unknown) {
      const text = e instanceof Error ? e.message : 'Could not send the request.';
      setResult({ kind: 'error', text });
      announce(text);
    } finally {
      setSending(false);
    }
  };

  const openScanner = async () => {
    const granted = permission?.granted || (await requestPermission()).granted;
    if (!granted) {
      const text = 'AccessAI needs the camera to scan a QR code. You can type the code instead.';
      setResult({ kind: 'error', text });
      announce(text);
      return;
    }
    scanned.current = false;
    setScanning(true);
  };

  const onScanned = ({ data }: BarcodeScanningResult) => {
    if (scanned.current) return;
    scanned.current = true;
    setScanning(false);
    announce('QR code scanned');
    void send(data);
  };

  const shareCode = () => {
    if (!friendCode) return;
    void Share.share({ message: `Add me on PDAccessAI! My friend code is ${friendCode}` });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <SectionHeader title="Your friend code" />
      <View style={styles.codeCard}>
        {friendCode ? (
          <>
            <Text style={styles.code} accessibilityLabel={`Your friend code: ${spellOut(friendCode)}`}>
              {friendCode}
            </Text>
            <QrCode value={`${QR_PREFIX}${friendCode}`} size={200} />
            <Text style={styles.codeHint}>Let a friend scan this, or share the code.</Text>
            <PrimaryButton title="Share my code" onPress={shareCode} />
          </>
        ) : online ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Text style={styles.codeHint}>Connect to the internet to see your friend code.</Text>
        )}
      </View>

      <SectionHeader title="Add someone" />
      <TextInput
        style={styles.input}
        value={code}
        onChangeText={setCode}
        placeholder="ABCD-2345"
        placeholderTextColor={colors.textMuted}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={12}
        accessibilityLabel="Friend's code"
        onSubmitEditing={() => void send(code)}
        returnKeyType="send"
      />
      <PrimaryButton
        title="Send friend request"
        onPress={() => void send(code)}
        loading={sending}
        disabled={!online || !code.trim()}
      />
      {Platform.OS !== 'web' ? (
        <View style={styles.scanWrap}>
          <PrimaryButton title="Scan a QR code" onPress={() => void openScanner()} disabled={!online || sending} />
        </View>
      ) : null}
      {!online ? <Text style={styles.note}>Connect to the internet to add friends.</Text> : null}

      {result ? (
        <View style={[styles.result, result.kind === 'error' && styles.resultError]}>
          <Ionicons
            name={result.kind === 'success' ? 'checkmark-circle-outline' : 'alert-circle-outline'}
            size={20}
            color={result.kind === 'success' ? colors.success : colors.dangerText}
          />
          <Text style={styles.resultText}>{result.text}</Text>
        </View>
      ) : null}

      <Modal visible={scanning} animationType="slide" onRequestClose={() => setScanning(false)}>
        <View style={styles.scanner}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={onScanned}
          />
          <View style={styles.scannerTop}>
            <IconButton icon="close" label="Close the scanner" variant="filled" onPress={() => setScanning(false)} />
          </View>
          <View style={styles.scannerFrame} pointerEvents="none" />
          <Text style={styles.scannerHint} accessibilityLiveRegion="polite">
            Point the camera at your friend&apos;s QR code.
          </Text>
        </View>
      </Modal>
    </ScrollView>
  );
}

const makeStyles = (t: AppTheme) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: t.colors.background,
    },
    content: {
      padding: Spacing.four,
      paddingTop: Spacing.two,
      paddingBottom: Spacing.six,
    },
    codeCard: {
      alignItems: 'center',
      gap: 14,
      padding: Spacing.four,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
    },
    code: {
      fontSize: t.font(32),
      fontWeight: t.weight('900'),
      letterSpacing: 3,
      color: t.colors.textPrimary,
      fontVariant: ['tabular-nums'],
    },
    codeHint: {
      fontSize: t.font(14),
      color: t.colors.textSecondary,
      textAlign: 'center',
    },
    input: {
      minHeight: 56,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: t.colors.inputBorder,
      borderRadius: 14,
      paddingHorizontal: 16,
      fontSize: t.font(22),
      fontWeight: t.weight('700'),
      letterSpacing: 2,
      textAlign: 'center',
      color: t.colors.textPrimary,
      backgroundColor: t.colors.surface,
    },
    scanWrap: {
      marginTop: 10,
    },
    note: {
      marginTop: 10,
      fontSize: t.font(13),
      color: t.colors.textSecondary,
    },
    result: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: Spacing.three,
      padding: 12,
      borderRadius: 12,
      backgroundColor: t.colors.primaryLight,
    },
    resultError: {
      backgroundColor: t.colors.surfaceAlt,
    },
    resultText: {
      flex: 1,
      fontSize: t.font(14),
      lineHeight: t.lineHeight(20),
      color: t.colors.textPrimary,
    },
    scanner: {
      flex: 1,
      backgroundColor: '#000000',
      alignItems: 'center',
      justifyContent: 'center',
    },
    scannerTop: {
      position: 'absolute',
      top: 48,
      right: 16,
    },
    scannerFrame: {
      width: 240,
      height: 240,
      borderRadius: 20,
      borderWidth: 4,
      borderColor: '#FFFFFF',
    },
    scannerHint: {
      position: 'absolute',
      bottom: 64,
      left: 24,
      right: 24,
      textAlign: 'center',
      fontSize: t.font(16),
      fontWeight: t.weight('700'),
      color: '#FFFFFF',
    },
  });
