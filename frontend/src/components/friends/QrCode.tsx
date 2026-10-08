import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import makeQrCode from 'qrcode-generator';

type QrCodeProps = {
  value: string;
  /** Width and height in points. */
  size?: number;
};

/**
 * A QR code drawn with plain Views (no SVG library or native module needed).
 * Each row merges neighboring dark squares into one bar, so a code takes a
 * few hundred Views rather than a thousand. Always black on white with a
 * quiet border, whatever the color scheme, so any camera can read it.
 */
export function QrCode({ value, size = 200 }: QrCodeProps) {
  const rows = useMemo(() => {
    const qr = makeQrCode(0, 'M');
    qr.addData(value);
    qr.make();
    const count = qr.getModuleCount();
    const result: { start: number; length: number }[][] = [];
    for (let r = 0; r < count; r++) {
      const runs: { start: number; length: number }[] = [];
      let c = 0;
      while (c < count) {
        if (qr.isDark(r, c)) {
          const start = c;
          while (c < count && qr.isDark(r, c)) c++;
          runs.push({ start, length: c - start });
        } else {
          c++;
        }
      }
      result.push(runs);
    }
    return { count, rows: result };
  }, [value]);

  const quiet = 4; // the blank margin scanners need, in modules
  // Whole points per square, so no hairline gaps appear between them.
  const cell = Math.max(1, Math.floor(size / (rows.count + quiet * 2)));
  const side = cell * (rows.count + quiet * 2);

  return (
    <View
      style={[styles.frame, { width: side, height: side, padding: cell * quiet }]}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      {rows.rows.map((runs, r) => (
        <View key={r} style={{ height: cell }}>
          {runs.map((run) => (
            <View
              key={run.start}
              style={[styles.dark, { left: run.start * cell, width: run.length * cell, height: cell }]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    backgroundColor: '#FFFFFF',
  },
  dark: {
    position: 'absolute',
    top: 0,
    backgroundColor: '#000000',
  },
});
