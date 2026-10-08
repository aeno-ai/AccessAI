const { callAi, AiUnavailable, knownIntent } = require('../utils/aiClient');

const OFFLINE = { message: "Accel can't think online right now.", code: 'ACCEL_OFFLINE' };

// Nothing said to Accel is stored or logged — it goes to the AI service,
// the answer comes back, and that's it.

// "What does the person want?" → one intent id from the fixed list, plus
// the details it needs (friend name, message text, friend code, value).
const interpret = async (req, res, next) => {
  try {
    const result = await callAi('/interpret', { method: 'POST', json: { text: req.body.text, screen: req.body.screen } });
    const intent = typeof result.intent === 'string' && knownIntent(result.intent) ? result.intent : 'none';
    const slots = result.slots && typeof result.slots === 'object' ? result.slots : {};
    // Only short strings go back to the app, whatever the model produced.
    const clean = {};
    for (const key of ['friendName', 'messageText', 'friendCode', 'value']) {
      if (typeof slots[key] === 'string' && slots[key].trim()) {
        clean[key] = slots[key].trim().slice(0, key === 'messageText' ? 300 : 60);
      }
    }
    res.json({
      intent,
      slots: clean,
      confidence: Number(result.confidence) || 0,
      source: result.source === 'llm' || result.source === 'vector' ? result.source : 'none',
    });
  } catch (error) {
    if (error instanceof AiUnavailable) return res.status(503).json(OFFLINE);
    next(error);
  }
};

// Tidies a message (grammar, or sign words → sentence). The app always
// shows the result and lets the person undo it before sending.
const polish = async (req, res, next) => {
  try {
    const { text, kind, language } = req.body;
    const result = await callAi('/polish', { method: 'POST', json: { text, kind, language: language ?? 'auto' } });
    const polished = typeof result.text === 'string' && result.text.trim() ? result.text.trim().slice(0, 500) : text;
    res.json({ text: polished, changed: polished !== text });
  } catch (error) {
    if (error instanceof AiUnavailable) return res.status(503).json(OFFLINE);
    next(error);
  }
};

module.exports = { interpret, polish };
