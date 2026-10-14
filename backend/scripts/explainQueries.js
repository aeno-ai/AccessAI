// How hard the database works for the busiest queries: for each, MongoDB's
// own explain('executionStats') — which index it used (or COLLSCAN = read
// the whole collection), and how many index keys and documents it read to
// return how many. Run it before and after an index change to prove what
// the change did (HANDOFF §19, for the defense):
//
//   node scripts/explainQueries.js                 print the table
//   node scripts/explainQueries.js --out before.json   also save it
//
// Read-only: explain() runs the query without changing anything. It runs
// as "Andrew (Demo)" (npm run sos-demo), or else whoever has the most
// friends; ids are never printed.
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });
const mongoose = require('mongoose');
const User = require('../src/models/Users');
const Friendship = require('../src/models/Friendship');
const DirectMessage = require('../src/models/DirectMessage');
const SOSEvent = require('../src/models/SOSEvent');

const DEMO_EMAIL = 'andrew.demo@accessai.test';

// The stages of the winning plan, e.g. "FETCH ← IXSCAN(requester_1_status_1)".
function describePlan(stage) {
  if (!stage) return '';
  const name = stage.indexName ? `${stage.stage}(${stage.indexName})` : stage.stage;
  const inputs = stage.inputStages ?? (stage.inputStage ? [stage.inputStage] : []);
  if (!inputs.length) return name;
  const below = inputs.map(describePlan);
  return `${name} ← ${below.length > 1 ? `[${below.join(' | ')}]` : below[0]}`;
}

async function explain(label, query) {
  const result = await query.explain('executionStats');
  const plan = result.queryPlanner.winningPlan.queryPlan ?? result.queryPlanner.winningPlan;
  const stats = result.executionStats;
  return {
    query: label,
    plan: describePlan(plan),
    keysExamined: stats.totalKeysExamined,
    docsExamined: stats.totalDocsExamined,
    returned: stats.nReturned,
    ms: stats.executionTimeMillis,
  };
}

async function pickUser() {
  const demo = await User.findOne({ email: DEMO_EMAIL }).select('_id').lean();
  if (demo) return { id: demo._id, who: 'Andrew (Demo)' };
  const [top] = await Friendship.aggregate([
    { $match: { status: 'accepted' } },
    { $project: { people: ['$requester', '$recipient'] } },
    { $unwind: '$people' },
    { $group: { _id: '$people', friends: { $sum: 1 } } },
    { $sort: { friends: -1 } },
    { $limit: 1 },
  ]);
  return top ? { id: top._id, who: `the account with the most friends (${top.friends})` } : null;
}

(async () => {
  const outIndex = process.argv.indexOf('--out');
  const outFile = outIndex > -1 ? process.argv[outIndex + 1] : null;

  await mongoose.connect(process.env.MONGO_URI);
  try {
    const user = await pickUser();
    if (!user) {
      console.log('No friendships in the database yet — nothing to explain.');
      return;
    }
    const me = user.id;
    const now = new Date();
    const friendship =
      (await Friendship.findOne({ status: 'accepted', $or: [{ requester: me }, { recipient: me }] }).lean()) ?? null;
    const friendId = friendship && (String(friendship.requester) === String(me) ? friendship.recipient : friendship.requester);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const counts = {
      users: await User.estimatedDocumentCount(),
      friendships: await Friendship.estimatedDocumentCount(),
      directMessages: await DirectMessage.estimatedDocumentCount(),
      sosEvents: await SOSEvent.estimatedDocumentCount(),
    };

    const rows = [
      await explain(
        'friend list: my accepted friendships',
        Friendship.find({ status: 'accepted', $or: [{ requester: me }, { recipient: me }] }),
      ),
      await explain('pending friend requests', Friendship.find({ status: 'pending', $or: [{ requester: me }, { recipient: me }] })),
    ];
    if (friendship) {
      rows.push(
        await explain(
          'unread count in one chat (covered: index only)',
          DirectMessage.find(
            { friendshipId: friendship._id, senderId: friendId, createdAt: { $gt: new Date(0) } },
            { _id: 0, friendshipId: 1 },
          ),
        ),
        await explain(
          'last message in one chat',
          DirectMessage.find({ friendshipId: friendship._id }).sort({ createdAt: -1 }).limit(1),
        ),
        await explain(
          'open a chat: newest 100 messages',
          DirectMessage.find({ friendshipId: friendship._id }).sort({ createdAt: 1 }).limit(100),
        ),
      );
    }
    rows.push(
      await explain(
        'my active SOS (newest first)',
        SOSEvent.find({ userId: me, status: 'active', expiresAt: { $gt: now } }).sort({ createdAt: -1 }).limit(1),
      ),
      await explain(
        "friends' active SOS",
        SOSEvent.find({ recipients: me, status: 'active', expiresAt: { $gt: now } }).sort({ createdAt: -1 }).limit(20),
      ),
      await explain('SOS expiry job (every 10 min)', SOSEvent.find({ status: 'active', expiresAt: { $lte: now } })),
      await explain(
        'account purge job (hourly)',
        User.find({
          $or: [{ deletionScheduledFor: { $lte: now } }, { emailVerified: false, createdAt: { $lte: weekAgo } }],
        }).select('_id'),
      ),
      await explain('push token cleanup', User.find({ 'pushTokens.token': 'ExponentPushToken[none]' }).select('_id')),
    );

    console.log(`Explained as ${user.who}. Collections: ${JSON.stringify(counts)}\n`);
    console.table(rows);
    if (outFile) {
      fs.writeFileSync(outFile, JSON.stringify({ at: now.toISOString(), counts, rows }, null, 2));
      console.log(`Saved to ${outFile}`);
    }
  } finally {
    await mongoose.disconnect();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
