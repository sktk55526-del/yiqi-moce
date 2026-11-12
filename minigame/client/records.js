'use strict';
const RECORD_KEY = 'moce.records.v1';
const LIMIT = 20;

function readRecords(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(r => r && typeof r.id === 'string' && Array.isArray(r.players) && r.players.length >= 2
    && r.players.length <= 6 && Number.isInteger(r.self) && r.self >= 0 && r.self < r.players.length
    && r.result && Array.isArray(r.result.deltas) && r.result.deltas.length === r.players.length
    && Array.isArray(r.history) && Array.isArray(r.scores) && r.options && Number.isInteger(r.options.decks)
    && Number.isFinite(r.savedAt) && r.players.every(p => p && typeof p.name === 'string')
    && r.result.deltas.every(Number.isFinite) && r.scores.every(Number.isFinite)
    && r.history.length <= 120 && r.history.every(e => e && typeof e.type === 'string' && Array.isArray(e.counts))).slice(0, LIMIT);
}

function saveRecord(records, state, difficulty, now = Date.now()) {
  const round = state.round;
  if (!round?.result || !round.startedAt) return records;
  const id = (state.code || 'practice') + ':' + round.startedAt + ':' + round.number;
  if (records.some(record => record.id === id)) return records;
  const record = { id, savedAt: now, startedAt: round.startedAt, mode: state.code ? 'friends' : 'practice',
    difficulty: state.code ? null : difficulty, number: round.number, self: state.self,
    players: state.players.map(p => ({ name: p.name, avatar: p.avatar })), options: { ...state.options },
    result: round.result, scores: round.scores, stats: round.stats, history: round.history || [], historyCount: round.historyCount || 0 };
  // JSON copy isolates the stored result from later rounds. No seat/session credentials or private hand.
  return [JSON.parse(JSON.stringify(record)), ...records].slice(0, LIMIT);
}

function recordStats(records, mode) {
  const filtered = records.filter(r => !mode || r.mode === mode);
  const wins = filtered.filter(r => r.result.winner === r.self).length;
  const draws = filtered.filter(r => r.result.winner === null).length;
  return { played: filtered.length, wins, draws, points: filtered.reduce((n, r) => n + r.result.deltas[r.self], 0) };
}

module.exports = { RECORD_KEY, LIMIT, readRecords, saveRecord, recordStats };
