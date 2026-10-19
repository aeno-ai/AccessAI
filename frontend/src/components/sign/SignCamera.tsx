import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Camera, useCameraDevice, type CameraOutput } from 'react-native-vision-camera';
import { N_POINTS, OFF_FACE, OFF_POSE, present, x, y, type Frame } from '@/sign/features';
import type { SignDebug } from '@/sign/reader';

type Props = {
  /** The sign reader's camera output (useSignRecognition). */
  output: CameraOutput | null;
  facing: 'front' | 'back';
  isActive: boolean;
  style?: StyleProp<ViewStyle>;
  /** Testing only: draw MediaPipe's points and the signing line. */
  debug?: SignDebug;
  /** The preview is shown mirrored (front camera); the dots follow it. */
  mirroredPreview?: boolean;
};

/**
 * The camera for sign language (sign mode, the sign camera screen, Learn's
 * camera check). Every frame is read on the phone by the sign reader's
 * output; nothing is recorded. Dim rooms get the camera's low-light boost,
 * on cameras that have one.
 */
export function SignCamera({ output, facing, isActive, style, debug, mirroredPreview = facing === 'front' }: Props) {
  const device = useCameraDevice(facing);
  if (!output || !device) return <View style={[styles.camera, style]} />;
  return (
    <View style={[styles.camera, style]}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isActive}
        outputs={[output]}
        // Only where the camera has it: asking for it elsewhere stops the camera.
        enableLowLightBoost={device.supportsLowLightBoost}
        resizeMode="cover"
      />
      {debug ? <LandmarkOverlay debug={debug} mirrored={mirroredPreview} /> : null}
    </View>
  );
}

const COLORS = { hand: '#FFD400', pose: '#3DDC84', face: '#56B4FF' };

/**
 * The testing view: one dot per point (hands yellow, body green, face blue)
 * and the signing line — so it's plain whether MediaPipe sees the hands and
 * shoulders. About 15 updates a second; development builds only.
 */
function LandmarkOverlay({ debug, mirrored }: { debug: SignDebug; mirrored: boolean }) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [snapshot, setSnapshot] = useState<SignDebug | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setSnapshot({ ...debug }), 66);
    return () => clearInterval(timer);
  }, [debug]);

  const frame: Frame | null = snapshot?.frame ?? null;
  // The preview fills the view ("cover"): map frame coordinates the same way.
  const { width, height } = size;
  const aspect = snapshot?.aspect ?? 1;
  const viewAspect = width / Math.max(height, 1);
  const scale = aspect > viewAspect ? height : width / aspect; // frame height in view pixels
  const frameWidth = scale * aspect;
  const offsetX = (width - frameWidth) / 2;
  const offsetY = (height - scale) / 2;
  const toView = (px: number, py: number) => ({
    left: offsetX + (mirrored ? 1 - px : px) * frameWidth,
    top: offsetY + py * scale,
  });

  const dots = [];
  if (frame && width) {
    for (let p = 0; p < N_POINTS; p += 1) {
      if (!(present(frame, p) > 0)) continue;
      const at = toView(x(frame, p), y(frame, p));
      const color = p < OFF_POSE ? COLORS.hand : p < OFF_FACE ? COLORS.pose : COLORS.face;
      dots.push(<View key={p} style={[overlay.dot, { left: at.left - 3, top: at.top - 3, backgroundColor: color }]} />);
    }
  }
  const line = snapshot?.lineY != null && width ? offsetY + snapshot.lineY * scale : null;

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      onLayout={(e) => setSize({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
    >
      {dots}
      {line !== null ? <View style={[overlay.line, { top: line }]} /> : null}
      <Text style={overlay.label}>
        {snapshot
          ? `${snapshot.phase} · frames ${snapshot.frames} (${Math.round(snapshot.fps)}/s) · ${frame ? 'points' : 'no points'} · model ${snapshot.modelReady ? 'ready' : 'loading'}${snapshot.guess ? ` · ${snapshot.guess}` : ''}${snapshot.error ? `
${snapshot.error}` : ''}`
          : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  camera: {
    flex: 1,
    backgroundColor: '#000000',
  },
});

const overlay = StyleSheet.create({
  dot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  line: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#FF5A5A',
  },
  label: {
    position: 'absolute',
    left: 8,
    bottom: 60,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'rgba(0,0,0,0.6)',
    color: '#FFFFFF',
    fontSize: 12,
  },
});
