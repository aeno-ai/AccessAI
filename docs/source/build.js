const fs = require('fs');
const path = require('path');
const { Packer } = require('docx');
const { P, H1, H2, bullets, table, note, titlePage, toc, makeDocument } = require('./lib');

// Appendix B: every source file, a table per folder.
const appendixB = () => [
  H1('Appendix B — Every file, and what is inside it'),
  P('All 303 source files of the app, the server, the AI service, the admin website and the tools, one line each. Paths are from the folder named in each heading. Generated files, images and installed packages are left out.'),
  ...files.flatMap(([title, base, intro, rows]) => [
    H2(base ? `${title} — ${base}` : title),
    ...(intro ? [P(intro)] : []),
    table(['File', 'What is inside'], rows.map(([file, what]) => [`\`${file}\``, what]), [38, 62]),
  ]),
];
const part1 = require('./part1');
const part2 = require('./part2');
const part3 = require('./part3');
const { part4, part5, appendix } = require('./part45');
const part6 = require('./part6');
const files = require('./files');
const defense = require('./defense');

// Writes the two reports into docs/ (or the folder given).
const OUT = process.argv[2] || path.join(__dirname, '..');
const data = path.join(__dirname, 'data');
const before = JSON.parse(fs.readFileSync(path.join(data, 'explain-before.json'), 'utf8'));
const after = JSON.parse(fs.readFileSync(path.join(data, 'explain-after.json'), 'utf8'));

const shortPlan = (plan) => plan.replace(/PROJECTION_(SIMPLE|COVERED) ← /g, (m, kind) => (kind === 'COVERED' ? 'COVERED ← ' : ''));
const explainRows = before.rows.map((b, i) => {
  const a = after.rows[i];
  return [b.query, `\`${shortPlan(b.plan)}\`\n${b.keysExamined} keys / ${b.docsExamined} documents → ${b.returned} returned`, `\`${shortPlan(a.plan)}\`\n${a.keysExamined} keys / ${a.docsExamined} documents → ${a.returned} returned`];
});

const results = {
  counts: `${before.counts.users} users, ${before.counts.friendships} friendships, ${before.counts.directMessages} chat messages, ${before.counts.sosEvents} SOS events`,
  explainRows,
  rateCheck: '15 of 15 checks pass — 120 pass, the 121st is refused with Retry-After 1, tokens come back after 1 s, 30 refusals block with Retry-After 300, still blocked a minute later, unblocked after 5 minutes with a full bucket, 40 refusals spread over 2 minutes never block, and the sweep drops idle buckets',
  rateE2e: 'a burst of 130 requests lets 120 through and refuses the rest with "slow down" and a Retry-After; 40 more within the minute block the account (Retry-After ≈ 300 s); another account is unaffected throughout (7 of 7 checks)',
  scaleProof: 'the full end-to-end suite against the real server and database, 109 of 109 checks on a freshly started server (12 October 2026), including a new `scale` suite (friend list, unread counts, backup of 200 long messages, repeats, size limits, two "I\'m safe" at once telling friends only once, `/api/health`) and a clean SIGTERM shutdown test.',
  testingAnswer: 'Automatic checks, all passing on 13 October 2026: 130 end-to-end checks against the running server and real database (errors and injection, accounts, staying logged in, Google-only accounts, SOS, push, AI, scale, Learn, rate limits) using throwaway accounts; 117 Accel rule sentences; 67 Learn checks (only words the models know, every sign\'s steps and clip, the locked levels, lessons, XP, hearts); 16 checks that two accounts on one phone never see each other\'s conversations; 15 token-bucket checks on a fake clock; the sign pipeline check (all 96 FSL test recordings read the same as the tester, and the new ASL model reads all 131 older recordings without an error); the colour contrast of every palette; TypeScript, lint and a full Android bundle. Plus testing on real phones (see HANDOFF.md).',
};

const today = '12 October 2026';

const howItWorks = makeDocument({
  title: 'AccessAI — How It Works',
  children: [
    ...titlePage('AccessAI — How It Works', 'Architecture, every feature, the data, and offline-first design', [
      'For the AccessAI team, to understand the system and explain it to the panel.',
      `Written from the code on ${today} (branch \`feature/accel-sos-push-sign-language\`).`,
      'Companion document: AccessAI — Defense Notes.',
    ]),
    ...toc(),
    H1('How to read this report'),
    P('Part 1 is the big picture: the pieces and how a request travels. Part 2 goes feature by feature, in the same pattern each time, ending with questions a panel is likely to ask. Part 3 explains MongoDB for someone new to it and describes every collection. Part 4 answers "what if there\'s no internet?" for every feature. Part 5 is a map of the project\'s folders. Part 6 opens up Accel\'s AI — embeddings, the ChromaDB vector database and RAG — for learning. Appendix A lists known gaps; Appendix B describes every file.'),
    P('File paths are written like `backend/src/app.js`; a path starting with `frontend/`, `backend/`, `ai/` or `admin/` is from the top of the project. Every statement was checked against the code; numbers (timeouts, limits, accuracies) are the ones in the files on the date above.'),
    ...part1(),
    ...part2(),
    ...part3(),
    ...part4(),
    ...part5(),
    ...part6(),
    ...appendix(),
    ...appendixB(),
  ],
});

const defenseNotes = makeDocument({
  title: 'AccessAI — Defense Notes',
  children: [
    ...titlePage('AccessAI — Defense Notes', 'Rate limiting, scalability, Learn, and likely panel questions', [
      'For the AccessAI team, preparing for the thesis defense.',
      `Written ${today}, with measurements from that day.`,
      'Companion document: AccessAI — How It Works.',
    ]),
    ...toc(),
    ...defense(results),
  ],
});

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'AccessAI-How-It-Works.docx'), await Packer.toBuffer(howItWorks));
  fs.writeFileSync(path.join(OUT, 'AccessAI-Defense-Notes.docx'), await Packer.toBuffer(defenseNotes));
  console.log('written to', OUT);
})();
