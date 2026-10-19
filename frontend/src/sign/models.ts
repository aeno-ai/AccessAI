import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import type { SignLanguage, SignUnit } from '@/hooks/use-preferences';
import type { FeatureOptions } from './features';
import { SignNet, type NetSpec } from './net';

/**
 * The sign models that come with the app (assets/sign-models/, made by
 * ai/scripts/export_sign_model.py). They run on the phone, offline.
 * Letters: none yet (HANDOFF.md §49 step 6).
 */
type Bundled = {
  spec: NetSpec;
  weights: number; // require() of model.bin
  labels: string[];
  meta: { fixedSeconds: number | null; minConfidence: number; features: FeatureOptions; aspectCorrected?: boolean };
};

const BUNDLED: Partial<Record<`${SignLanguage}/${SignUnit}`, Bundled>> = {
  'fsl/words': {
    spec: require('../../assets/sign-models/fsl/words/model.json'),
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- a bundled file (metro asset)
    weights: require('../../assets/sign-models/fsl/words/model.bin'),
    labels: require('../../assets/sign-models/fsl/words/labels.json'),
    meta: require('../../assets/sign-models/fsl/words/meta.json'),
  },
  'asl/words': {
    spec: require('../../assets/sign-models/asl/words/model.json'),
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- a bundled file (metro asset)
    weights: require('../../assets/sign-models/asl/words/model.bin'),
    labels: require('../../assets/sign-models/asl/words/labels.json'),
    meta: require('../../assets/sign-models/asl/words/meta.json'),
  },
};

export type SignModel = {
  language: SignLanguage;
  unit: SignUnit;
  net: SignNet;
  labels: string[];
  fixedSeconds: number | null;
  features: FeatureOptions;
  /** Trained on real proportions (x × width ÷ height); older models on 16:9 videos. */
  aspectCorrected: boolean;
};

/** Whether the app has a model for this language and unit. */
export const hasSignModel = (language: SignLanguage, unit: SignUnit) => Boolean(BUNDLED[`${language}/${unit}`]);

const loaded = new Map<string, Promise<SignModel>>();

/** Loads a model's weights once (a few MB), then keeps it. */
export function loadSignModel(language: SignLanguage, unit: SignUnit): Promise<SignModel> {
  const key = `${language}/${unit}` as const;
  let model = loaded.get(key);
  if (!model) {
    const bundled = BUNDLED[key];
    if (!bundled) return Promise.reject(new Error(`No ${unit} model for ${language.toUpperCase()} yet.`));
    model = (async () => {
      const asset = await Asset.fromModule(bundled.weights).downloadAsync();
      const bytes = await new File(asset.localUri ?? asset.uri).arrayBuffer();
      return {
        language,
        unit,
        net: new SignNet(bundled.spec, new Float32Array(bytes)),
        labels: bundled.labels,
        fixedSeconds: bundled.meta.fixedSeconds,
        features: bundled.meta.features,
        aspectCorrected: bundled.meta.aspectCorrected ?? false,
      };
    })();
    model.catch(() => loaded.delete(key));
    loaded.set(key, model);
  }
  return model;
}
