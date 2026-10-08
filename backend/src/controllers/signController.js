const { callAi, AiUnavailable } = require('../utils/aiClient');

// Sign language → text. The phone records short video pieces (~2 s each)
// one after another; each is passed straight to the Python AI service,
// which finds the body/hand points with MediaPipe, notices when a sign
// starts and ends, and runs the sign model. Videos are never saved — the
// AI service reads each piece and deletes it.
//
// Every session belongs to the account that started it: the AI service is
// told the owner, and refuses pieces from anyone else.

const OFFLINE = { message: 'Sign language needs the AccessAI server, which is not reachable right now.', code: 'SIGN_OFFLINE' };

function respondUnavailable(res, error) {
  // The AI service said the session is gone (expired after 2 idle minutes).
  if (error.upstreamStatus === 404) {
    return res.status(404).json({ message: 'Sign language stopped. Please start it again.', code: 'SIGN_SESSION_GONE' });
  }
  // e.g. letters chosen, but no letters model has been put in ai/models yet.
  if (error.upstreamStatus === 409) {
    return res.status(409).json({ message: "That sign model isn't installed yet.", code: 'SIGN_MODEL_MISSING' });
  }
  return res.status(503).json(OFFLINE);
}

// Which models are installed: e.g. FSL words yes, FSL letters not yet.
const listModels = async (req, res, next) => {
  try {
    res.json(await callAi('/sign/models', { timeoutMs: 4000 }));
  } catch (error) {
    if (error instanceof AiUnavailable) return respondUnavailable(res, error);
    next(error);
  }
};

const startSession = async (req, res, next) => {
  try {
    const { language, unit, minConfidence, flip } = req.body;
    const result = await callAi('/sign/session', {
      method: 'POST',
      json: { language, unit, minConfidence, flip: flip === true, owner: req.user.userId },
      timeoutMs: 6000,
    });
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof AiUnavailable) return respondUnavailable(res, error);
    next(error);
  }
};

// One video piece. req.body is the raw video (see express.raw in the route).
const sendChunk = async (req, res, next) => {
  try {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ message: "The video didn't arrive. Please try again." });
    }
    const result = await callAi(`/sign/session/${req.params.id}/chunk`, {
      method: 'POST',
      body: req.body,
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Owner': req.user.userId,
        'X-Chunk-Start': req.get('x-chunk-start'),
        'X-Chunk-Index': req.get('x-chunk-index'),
        // The last piece before signing stops: read any sign still waiting.
        'X-Chunk-Final': req.get('x-chunk-final') === '1' ? '1' : '0',
      },
      // Reading a 2-second piece takes the AI service about as long again.
      timeoutMs: 15000,
    });
    res.json(result);
  } catch (error) {
    if (error instanceof AiUnavailable) return respondUnavailable(res, error);
    next(error);
  }
};

const stopSession = async (req, res, next) => {
  try {
    await callAi(`/sign/session/${req.params.id}`, {
      method: 'DELETE',
      headers: { 'X-Owner': req.user.userId },
      timeoutMs: 4000,
    });
    res.json({ stopped: true });
  } catch (error) {
    // Already gone, or the service is down: either way it's stopped.
    if (error instanceof AiUnavailable) return res.json({ stopped: true });
    next(error);
  }
};

module.exports = { listModels, startSession, sendChunk, stopSession };
