const mongoose = require('mongoose');
const os = require('os');
const crypto = require('crypto');

// Timed jobs with several server copies (HANDOFF.md §52): every copy keeps
// its timer, but before a run it must hold the job's lease — one document
// per job in MongoDB, taken atomically. Only the holder runs; if it stops,
// the lease runs out and another copy takes over. With one copy it simply
// always gets the lease.

// Who this copy is (in the lease document and the logs).
const OWNER = `${os.hostname()}:${process.pid}:${crypto.randomBytes(3).toString('hex')}`;
const COLLECTION = 'job_leases';

/**
 * True if this copy now holds `name` for `ms` (taken, or renewed because it
 * already had it). False if another live copy holds it.
 */
async function acquireLease(name, ms, now = new Date()) {
  const leases = mongoose.connection.db.collection(COLLECTION);
  try {
    const result = await leases.findOneAndUpdate(
      { _id: name, $or: [{ until: { $lte: now } }, { owner: OWNER }] },
      { $set: { owner: OWNER, until: new Date(now.getTime() + ms), takenAt: now } },
      { upsert: true, returnDocument: 'after' },
    );
    return result?.owner === OWNER;
  } catch (error) {
    // Another copy holds a live lease: the upsert tried to insert a second
    // document with the same _id.
    if (error?.code === 11000) return false;
    throw error;
  }
}

/**
 * Runs `job` now and every `intervalMs`, on whichever copy holds its lease.
 * Returns the timer (for shutdown). Never throws.
 */
function scheduleLeasedJob(name, intervalMs, job) {
  const tick = async () => {
    try {
      // Held a little longer than one interval: the holder renews on its next tick.
      if (await acquireLease(name, intervalMs * 1.5)) await job();
    } catch (error) {
      console.error(`Timed job "${name}" failed:`, error);
    }
  };
  void tick();
  return setInterval(() => void tick(), intervalMs);
}

module.exports = { acquireLease, scheduleLeasedJob, OWNER };
