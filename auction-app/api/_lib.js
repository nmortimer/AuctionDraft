function defaultState() {
  return {
    phase: 'setup',
    settings: { increment: 1, nominationSeconds: 30, bidSeconds: 12, rosterLimit: 0 },
    teams: [],
    current: null, // {mode:'nominating', teamId, deadline} | {mode:'bidding', playerName, bid, leaderId, nominatorId, deadline}
    paused: false,
    pausedRemainingMs: null,
    commishPin: '',
    log: [],
    updatedAt: Date.now()
  };
}

// Never send the real PIN to the client — just whether one is set.
function sanitizeForClient(state) {
  const { commishPin, ...rest } = state;
  rest.hasCommishPin = !!commishPin;
  return rest;
}

function uid() {
  return 't' + Math.random().toString(36).slice(2, 9);
}

function beginNomination(teamId, secs) {
  return { mode: 'nominating', teamId, deadline: Date.now() + secs * 1000 };
}

function nextNominatorId(teams, afterId) {
  const idx = teams.findIndex(t => t.id === afterId);
  for (let s = 1; s <= teams.length; s++) {
    const t = teams[(idx + s) % teams.length];
    if (t && !t.passedNomination) return t.id;
  }
  return null;
}

function applySale(state, playerName, bid, leaderId, nominatorId) {
  const team = state.teams.find(t => t.id === leaderId);
  const over = (team.budget - bid) < 0;
  team.budget -= bid;
  team.spent += bid;
  team.roster.push({ player: playerName, price: bid, over });
  state.log.unshift({ player: playerName, teamId: leaderId, price: bid, over });
  const next = nextNominatorId(state.teams, nominatorId);
  state.current = next ? beginNomination(next, state.settings.nominationSeconds) : null;
}

// Catches up any turns that expired while nobody was polling (e.g. someone stepped away).
function processExpiry(state) {
  if (state.phase !== 'auction') return;
  if (state.paused) return;
  let guard = 0;
  while (state.current && state.current.deadline <= Date.now() && guard < 100) {
    guard++;
    if (state.current.mode === 'bidding') {
      if (state.current.leaderId) {
        const { playerName, bid, leaderId, nominatorId } = state.current;
        applySale(state, playerName, bid, leaderId, nominatorId);
      } else {
        state.current = null;
      }
    } else if (state.current.mode === 'nominating') {
      const teamId = state.current.teamId;
      const t = state.teams.find(x => x.id === teamId);
      if (t) t.passedNomination = true;
      const next = nextNominatorId(state.teams, teamId);
      state.current = next ? beginNomination(next, state.settings.nominationSeconds) : null;
    } else {
      break;
    }
  }
}

module.exports = { defaultState, uid, beginNomination, nextNominatorId, applySale, processExpiry, sanitizeForClient };
