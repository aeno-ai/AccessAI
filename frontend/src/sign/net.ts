/**
 * Runs a sign word model on the phone — the same multiply-and-add steps as
 * ai/app/sign/numpy_model.py (the tester's runner, checked against
 * TensorFlow). The weights come from `ai/scripts/export_sign_model.py`
 * (model.json + model.bin). `scripts/sign-check.ts` proves the top 5 match.
 *
 * Pure TypeScript, no native code: about 31 million multiply-adds per sign,
 * run once when a sign ends. Also runs the one-hand letters model (input
 * 1 × 42, Dense layers only).
 */

export type NetLayer = {
  kind: 'Dense' | 'BatchNormalization' | 'Conv1D' | 'Activation' | 'GlobalAveragePooling1D';
  activation?: 'relu' | 'softmax';
  epsilon?: number;
  /** Conv1D only: its k input frames are this many frames apart (default 1). */
  dilation?: number;
  weights: { shape: number[]; offset: number }[];
};

export type NetSpec = { inputShape: [number, number]; layers: NetLayer[] };

type Tensor = { data: Float32Array; rows: number; cols: number }; // rows = frames (1 after pooling)

function activate(t: Tensor, name: NetLayer['activation']): Tensor {
  if (name === 'relu') {
    for (let i = 0; i < t.data.length; i += 1) if (t.data[i] < 0) t.data[i] = 0;
  } else if (name === 'softmax') {
    for (let r = 0; r < t.rows; r += 1) {
      const row = t.data.subarray(r * t.cols, (r + 1) * t.cols);
      let max = -Infinity;
      for (const v of row) if (v > max) max = v;
      let sum = 0;
      for (let i = 0; i < row.length; i += 1) {
        row[i] = Math.exp(row[i] - max);
        sum += row[i];
      }
      for (let i = 0; i < row.length; i += 1) row[i] /= sum;
    }
  }
  return t;
}

export class SignNet {
  private readonly layers: { layer: NetLayer; w: Float32Array[] }[];

  constructor(
    readonly spec: NetSpec,
    weights: Float32Array,
  ) {
    this.layers = spec.layers.map((layer) => ({
      layer,
      w: layer.weights.map(({ shape, offset }) => weights.subarray(offset, offset + shape.reduce((a, b) => a * b, 1))),
    }));
  }

  /** One clip's features (frames × width, row by row) → probabilities. */
  predict(rows: Float32Array[]): Float32Array {
    const [frames, width] = this.spec.inputShape;
    if (rows.length !== frames || rows[0].length !== width) {
      throw new Error(`The model wants ${frames} × ${width} numbers, got ${rows.length} × ${rows[0]?.length}`);
    }
    let x: Tensor = { data: new Float32Array(frames * width), rows: frames, cols: width };
    rows.forEach((row, t) => x.data.set(row, t * width));

    for (const { layer, w } of this.layers) {
      if (layer.kind === 'Dense') {
        const [W, b] = w; // b is missing for a layer without a bias
        const out = layer.weights[0].shape[1];
        const y = new Float32Array(x.rows * out);
        for (let t = 0; t < x.rows; t += 1) {
          const yo = t * out;
          if (b) y.set(b, yo);
          for (let i = 0; i < x.cols; i += 1) {
            const v = x.data[t * x.cols + i];
            if (v === 0) continue;
            const wo = i * out;
            for (let o = 0; o < out; o += 1) y[yo + o] += v * W[wo + o];
          }
        }
        x = activate({ data: y, rows: x.rows, cols: out }, layer.activation);
      } else if (layer.kind === 'BatchNormalization') {
        const [gamma, beta, mean, variance] = w;
        const eps = layer.epsilon ?? 1e-3;
        const scale = new Float32Array(x.cols);
        for (let c = 0; c < x.cols; c += 1) scale[c] = gamma[c] / Math.sqrt(variance[c] + eps);
        for (let t = 0; t < x.rows; t += 1) {
          for (let c = 0; c < x.cols; c += 1) {
            const i = t * x.cols + c;
            x.data[i] = scale[c] * (x.data[i] - mean[c]) + beta[c];
          }
        }
      } else if (layer.kind === 'Conv1D') {
        // padding 'same': each output frame sums k frames, `dilation` apart.
        const [kernel, bias] = w;
        const [k, cin, cout] = layer.weights[0].shape;
        const d = layer.dilation ?? 1;
        const left = ((k - 1) * d) >> 1;
        const T = x.rows;
        const y = new Float32Array(T * cout);
        if (bias) for (let t = 0; t < T; t += 1) y.set(bias, t * cout);
        for (let j = 0; j < k; j += 1) {
          for (let t = 0; t < T; t += 1) {
            const src = t + j * d - left;
            if (src < 0 || src >= T) continue;
            const yo = t * cout;
            for (let i = 0; i < cin; i += 1) {
              const v = x.data[src * cin + i];
              if (v === 0) continue;
              const ko = (j * cin + i) * cout;
              for (let o = 0; o < cout; o += 1) y[yo + o] += v * kernel[ko + o];
            }
          }
        }
        x = activate({ data: y, rows: T, cols: cout }, layer.activation);
      } else if (layer.kind === 'Activation') {
        x = activate(x, layer.activation);
      } else if (layer.kind === 'GlobalAveragePooling1D') {
        const y = new Float32Array(x.cols);
        for (let t = 0; t < x.rows; t += 1) for (let c = 0; c < x.cols; c += 1) y[c] += x.data[t * x.cols + c];
        for (let c = 0; c < x.cols; c += 1) y[c] /= x.rows;
        x = { data: y, rows: 1, cols: x.cols };
      }
    }
    return x.data;
  }
}

/** The best `n` (index, probability), highest first. */
export function topK(probs: Float32Array, n = 5): [number, number][] {
  return Array.from(probs, (p, i) => [i, p] as [number, number])
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}
