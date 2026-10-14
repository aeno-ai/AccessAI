const LearnCompletion = require('../models/LearnCompletion');
const Friendship = require('../models/Friendship');
const User = require('../models/Users');
const { USABLE_ACCOUNT } = require('./friendController');

// Learn, the sign-language course. The phone keeps its own log of finished
// lessons and works everything out from it (offline first); the server just
// keeps a copy of that log — so a new phone gets the progress back — and
// adds up friends' XP for the weekly leaderboard.

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000; // UTC+8, no daylight saving

// When this week began: Monday 00:00 in the Philippines, as a real moment.
function weekStart(now = new Date()) {
  const manila = new Date(now.getTime() + MANILA_OFFSET_MS); // read its UTC fields as Manila's
  const daysSinceMonday = (manila.getUTCDay() + 6) % 7;
  const mondayManila = Date.UTC(manila.getUTCFullYear(), manila.getUTCMonth(), manila.getUTCDate() - daysSinceMonday);
  return new Date(mondayManila - MANILA_OFFSET_MS);
}

const toClient = (completion) => ({
  clientId: completion.clientId,
  course: completion.course,
  lessonId: completion.lessonId,
  xp: completion.xp,
  mistakes: completion.mistakes ?? 0,
  cameraPassed: completion.cameraPassed ?? 0,
  completedAt: completion.completedAt.getTime(),
});

// The phone's outbox: completions made since its last sync (up to 200).
// Saved once each — sending the same one again changes nothing — in one
// database call.
const syncCompletions = async (req, res, next) => {
  try {
    const me = req.user.userId;
    const { completions } = req.body;
    const result = await LearnCompletion.bulkWrite(
      completions.map((completion) => ({
        updateOne: {
          filter: { userId: me, clientId: completion.clientId },
          update: {
            $setOnInsert: {
              userId: me,
              clientId: completion.clientId,
              course: completion.course,
              lessonId: completion.lessonId,
              xp: completion.xp,
              mistakes: completion.mistakes,
              cameraPassed: completion.cameraPassed,
              completedAt: new Date(completion.completedAt),
            },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );
    res.json({ saved: result.upsertedCount, alreadyHad: completions.length - result.upsertedCount });
  } catch (error) {
    next(error);
  }
};

// Everything this account has finished, oldest first — what a new phone
// (or a reinstalled app) rebuilds the progress from.
const getProgress = async (req, res, next) => {
  try {
    const completions = await LearnCompletion.find({ userId: req.user.userId })
      .sort({ completedAt: 1, _id: 1 })
      .limit(5000)
      .select('clientId course lessonId xp mistakes cameraPassed completedAt')
      .lean();
    res.json({ completions: completions.map(toClient) });
  } catch (error) {
    next(error);
  }
};

// This week's XP for me and my friends (only accepted friends whose
// accounts are usable), most first. Friends with no XP yet are listed too.
const getLeaderboard = async (req, res, next) => {
  try {
    const me = req.user.userId;
    const since = weekStart();
    const friendships = await Friendship.find({ status: 'accepted', $or: [{ requester: me }, { recipient: me }] })
      .select('requester recipient')
      .lean();
    const friendIds = friendships.map((f) => (String(f.requester) === String(me) ? f.recipient : f.requester));
    const people = await User.find({ _id: { $in: [me, ...friendIds] }, ...USABLE_ACCOUNT })
      .select('name firstName')
      .lean();
    const ids = people.map((person) => person._id);

    const totals = await LearnCompletion.aggregate([
      { $match: { userId: { $in: ids }, completedAt: { $gte: since } } },
      { $group: { _id: '$userId', xp: { $sum: '$xp' } } },
    ]);
    const xpById = new Map(totals.map((row) => [String(row._id), row.xp]));

    const rows = people.map((person) => ({
      userId: String(person._id),
      name: person.firstName || person.name?.split(' ')[0] || 'Friend',
      xp: xpById.get(String(person._id)) ?? 0,
      me: String(person._id) === String(me),
    }));
    rows.sort((a, b) => b.xp - a.xp || a.name.localeCompare(b.name));
    res.json({ weekStart: since.getTime(), rows });
  } catch (error) {
    next(error);
  }
};

module.exports = { syncCompletions, getProgress, getLeaderboard, weekStart };
