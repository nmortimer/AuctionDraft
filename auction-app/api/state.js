const { getClient, KEY } = require('./_redis');
const { defaultState, processExpiry } = require('./_lib');

module.exports = async (req, res) => {
  try {
    const redis = await getClient();
    const raw = await redis.get(KEY);
    let state = raw ? JSON.parse(raw) : null;
    if (!state) {
      state = defaultState();
      await redis.set(KEY, JSON.stringify(state));
    }
    const before = JSON.stringify(state);
    processExpiry(state);
    if (JSON.stringify(state) !== before) {
      await redis.set(KEY, JSON.stringify(state));
    }
    res.status(200).json(state);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
};
