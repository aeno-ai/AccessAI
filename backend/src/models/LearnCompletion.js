const mongoose = require('mongoose');

// One finished Learn lesson (or review), as the phone recorded it. The phone
// works out everything else from these — XP, level, streak, which lessons
// are open, badges — so a new phone rebuilds a person's progress from this
// list alone. Written offline first and sent later (the phone's outbox), so
// `completedAt` is the phone's time and `clientId` (made by the phone) keeps
// a re-sent one from being saved twice. Never changed once saved.
const learnCompletionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    clientId: { type: String, required: true, trim: true, maxlength: 100 },
    // Which course: Filipino or American Sign Language.
    course: { type: String, enum: ['fsl', 'asl'], required: true },
    // Which lesson in that course, e.g. "fsl-greetings-1" or "asl-basics-review".
    lessonId: { type: String, required: true, trim: true, maxlength: 80 },
    xp: { type: Number, required: true, min: 0, max: 30 },
    // Quiz answers that were wrong (0 = a perfect lesson).
    mistakes: { type: Number, default: 0, min: 0, max: 50 },
    // Signs done right in front of the camera during the lesson.
    cameraPassed: { type: Number, default: 0, min: 0, max: 10 },
    completedAt: { type: Date, required: true },
  },
  { timestamps: true },
);

// One clientId per account: the same completion sent twice is saved once.
// Its first field (userId) also serves "all of my completions".
learnCompletionSchema.index({ userId: 1, clientId: 1 }, { unique: true });
// The weekly leaderboard: my friends' completions since Monday.
learnCompletionSchema.index({ userId: 1, completedAt: 1 });

module.exports = mongoose.model('LearnCompletion', learnCompletionSchema);
