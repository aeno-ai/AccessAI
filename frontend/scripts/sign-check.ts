/// <reference types="node" />
// Proves the phone's copy of the sign pipeline (src/sign/) gives the same
// numbers as the Python one the models were trained with:
//   npx tsx scripts/sign-check.ts
// The fixtures come from `ai/scripts/export_sign_fixtures.py` (the tester's
// real recordings). Same sampled frames, same normalized clip, same model
// input (to 1e-4), same places where a sign or a held letter is cut.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildHand21, makeFeatures, normalize, sampleFrameIndices, T_FRAMES, type Frame } from '../src/sign/features';
import { AutoSegmenter, HoldSegmenter } from '../src/sign/segmenter';
import { SignNet, topK, type NetSpec } from '../src/sign/net';

type Case = {
  name: string;
  features: { hand?: boolean; velocity?: boolean };
  fixedSeconds: number | null;
  raw: number[][];
  indices: number[];
  normalized: number[][];
  input: number[][];
  top5: [number, number][];
  stream: { aspect: number; fps: number; frames: number[][]; cuts: number[] };
};
type Hold = { frames: number[][]; cuts: number[]; hand21: number[] | null };

const fixtures = JSON.parse(readFileSync(join(__dirname, 'fixtures', 'sign-fixtures.json'), 'utf8')) as {
  cases: Case[];
  holds: Hold[];
};

let passed = 0;
let failed = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) {
    passed += 1;
  } else {
    failed += 1;
    console.log(`✗ ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  }
}

const TOLERANCE = 1e-4;
function maxDiff(a: ArrayLike<number>[], b: number[][]): number {
  let worst = 0;
  for (let i = 0; i < b.length; i += 1) {
    for (let j = 0; j < b[i].length; j += 1) worst = Math.max(worst, Math.abs(a[i][j] - b[i][j]));
  }
  return worst;
}
const frames = (rows: number[][]): Frame[] => rows.map((row) => Float32Array.from(row));

for (const c of fixtures.cases) {
  const raw = frames(c.raw);
  const idx = sampleFrameIndices(raw.length, T_FRAMES);
  check(`${c.name}: the same 32 frames`, idx.join(',') === c.indices.join(','), { ours: idx, theirs: c.indices });
  const norm = normalize(idx.map((i) => raw[i]));
  const nd = maxDiff(norm, c.normalized);
  check(`${c.name}: normalized clip (max diff ${nd.toExponential(1)})`, nd < TOLERANCE);
  const feats = makeFeatures(norm, c.features);
  check(`${c.name}: input width ${feats[0].length}`, feats[0].length === c.input[0].length);
  const fd = maxDiff(feats, c.input);
  check(`${c.name}: model input (max diff ${fd.toExponential(1)})`, fd < TOLERANCE);

  const seg = new AutoSegmenter();
  const cuts: number[] = [];
  frames(c.stream.frames).forEach((f, i) => {
    const clip = seg.update(i / c.stream.fps, f, c.stream.aspect, c.fixedSeconds);
    if (clip) cuts.push(clip.length);
  });
  for (const clip of seg.flush()) cuts.push(clip.length);
  check(`${c.name}: the sign is cut in the same place`, cuts.join(',') === c.stream.cuts.join(','), { ours: cuts, theirs: c.stream.cuts });
}

fixtures.holds.forEach((h, n) => {
  const seg = new HoldSegmenter();
  const held = frames(h.frames);
  const cuts: number[] = [];
  held.forEach((f, i) => {
    const clip = seg.update(i / 30, f);
    if (clip) cuts.push(clip.length);
  });
  check(`hold ${n + 1}: the letter is read at the same frame`, cuts.join(',') === h.cuts.join(','), { ours: cuts, theirs: h.cuts });
  const hand = buildHand21(held);
  if (h.hand21 === null) {
    check(`hold ${n + 1}: no hand`, hand === null);
  } else {
    const d = hand ? maxDiff([hand], [h.hand21]) : Infinity;
    check(`hold ${n + 1}: the 42 hand numbers (max diff ${d.toExponential(1)})`, d < TOLERANCE);
  }
});

// The on-phone model runner (src/sign/net.ts) vs the NumPy one, on the same input.
const nets = new Map<string, SignNet>();
function netFor(language: string): SignNet {
  let net = nets.get(language);
  if (!net) {
    const folder = join(__dirname, '..', 'assets', 'sign-models', language, 'words');
    const spec = JSON.parse(readFileSync(join(folder, 'model.json'), 'utf8')) as NetSpec;
    const bytes = readFileSync(join(folder, 'model.bin'));
    net = new SignNet(spec, new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4));
    nets.set(language, net);
  }
  return net;
}
for (const c of fixtures.cases) {
  const language = c.name.split('/')[0];
  const started = Date.now();
  const top = topK(netFor(language).predict(c.input.map((row) => Float32Array.from(row))));
  const ms = Date.now() - started;
  const same = top.every(([i], n) => i === c.top5[n][0]);
  const pd = Math.max(...top.map(([, p], n) => Math.abs(p - c.top5[n][1])));
  check(`${c.name}: the model's top 5 (prob diff ${pd.toExponential(1)}, ${ms} ms)`, same && pd < TOLERANCE, { ours: top, theirs: c.top5 });
}

check('fixtures have cases for both languages', new Set(fixtures.cases.map((c) => c.name.split('/')[0])).size === 2);
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
