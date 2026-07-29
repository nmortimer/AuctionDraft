const { redis, KEY } = require('./_redis');
const {
  defaultState, uid, beginNomination, nextNominatorId, applySale, processExpiry
} = require('./_lib');

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).end(); return; }
  const { type, payload = {} } = req.body || {};

  try {
    let state = await redis.get(KEY);
    if (!state) state = defaultState();
    processExpiry(state);

    switch (type) {
      case 'addTeam': {
        state.teams.push({
          id: uid(), name: payload.name, budget: payload.budget,
          spent: 0, roster: [], passedNomination: false
        });
        break;
      }
      case 'removeTeam': {
        state.teams = state.teams.filter(t => t.id !== payload.id);
        break;
      }
      case 'moveTeam': {
        const idx = state.teams.findIndex(t => t.id === payload.id);
        const swap = idx + payload.dir;
        if (idx >= 0 && swap >= 0 && swap < state.teams.length) {
          [state.teams[idx], state.teams[swap]] = [state.teams[swap], state.teams[idx]];
        }
        break;
      }
      case 'startAuction': {
        if (state.teams.length >= 2) {
          state.settings = payload.settings;
          state.phase = 'auction';
          state.current = beginNomination(state.teams[0].id, state.settings.nominationSeconds);
        }
        break;
      }
      case 'nominate': {
        if (!state.paused && state.current && state.current.mode === 'nominating' && state.current.teamId === payload.myTeamId && payload.playerName) {
          state.current = {
            mode: 'bidding', playerName: payload.playerName, bid: 1,
            leaderId: payload.myTeamId, nominatorId: payload.myTeamId,
            deadline: Date.now() + state.settings.bidSeconds * 1000
          };
        }
        break;
      }
      case 'pass': {
        if (!state.paused && state.current && state.current.mode === 'nominating' && state.current.teamId === payload.myTeamId) {
          const t = state.teams.find(x => x.id === payload.myTeamId);
          if (t) t.passedNomination = true;
          const next = nextNominatorId(state.teams, payload.myTeamId);
          state.current = next ? beginNomination(next, state.settings.nominationSeconds) : null;
        }
        break;
      }
      case 'bid': {
        if (!state.paused && state.current && state.current.mode === 'bidding' && payload.amount > state.current.bid) {
          state.current.bid = payload.amount;
          state.current.leaderId = payload.teamId;
          state.current.deadline = Date.now() + state.settings.bidSeconds * 1000;
        }
        break;
      }
      case 'manualSell': {
        if (state.current && state.current.mode === 'bidding' && state.current.leaderId) {
          const { playerName, bid, leaderId, nominatorId } = state.current;
          applySale(state, playerName, bid, leaderId, nominatorId);
        }
        break;
      }
      case 'undo': {
        if (state.log.length > 0) {
          const last = state.log.shift();
          const t = state.teams.find(x => x.id === last.teamId);
          if (t) {
            t.budget += last.price;
            t.spent -= last.price;
            const idx = t.roster.findIndex(r => r.player === last.player && r.price === last.price);
            if (idx !== -1) t.roster.splice(idx, 1);
          }
        }
        break;
      }
      case 'endDraft': state.phase = 'summary'; break;
      case 'backToAuction': state.phase = 'auction'; break;
      case 'reset': state = defaultState(); break;

      case 'pause': {
        if (state.current && !state.paused) {
          state.paused = true;
          state.pausedRemainingMs = Math.max(0, state.current.deadline - Date.now());
        }
        break;
      }
      case 'resume': {
        if (state.paused && state.current) {
          state.current.deadline = Date.now() + (state.pausedRemainingMs || 0);
          state.paused = false;
          state.pausedRemainingMs = null;
        }
        break;
      }
      case 'extendClock': {
        if (state.current) {
          if (state.paused) {
            state.pausedRemainingMs = Math.max(0, (state.pausedRemainingMs || 0) + payload.ms);
          } else {
            state.current.deadline += payload.ms;
          }
        }
        break;
      }
      case 'forcePass': {
        if (state.current && state.current.mode === 'nominating') {
          const teamId = state.current.teamId;
          const t = state.teams.find(x => x.id === teamId);
          if (t) t.passedNomination = true;
          const next = nextNominatorId(state.teams, teamId);
          state.current = next ? beginNomination(next, state.settings.nominationSeconds) : null;
        }
        break;
      }
      case 'updateSettings': {
        const s = payload || {};
        if (!isNaN(s.increment) && s.increment > 0) state.settings.increment = s.increment;
        if (!isNaN(s.nominationSeconds) && s.nominationSeconds > 0) state.settings.nominationSeconds = s.nominationSeconds;
        if (!isNaN(s.bidSeconds) && s.bidSeconds > 0) state.settings.bidSeconds = s.bidSeconds;
        if (!isNaN(s.rosterLimit) && s.rosterLimit >= 0) state.settings.rosterLimit = s.rosterLimit;
        break;
      }
      default: break;
    }

    await redis.set(KEY, state);
    res.status(200).json(state);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
};
