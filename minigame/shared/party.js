'use strict';

const PROTOCOL = 2;
function ensureParty(room) {
  room.spectators ??= [];
  room.players.forEach((p, i) => { p.id ??= 'seat-' + i; });
  room.match ??= { completed: 0, limit: room.options.roundLimit || 0, finished: false, ledger: [], rounds: [], highlights: [] };
  for (const p of room.players) if (!room.match.ledger.some(e => e.id === p.id)) {
    room.match.ledger.push({ id: p.id, name: p.name, avatar: p.avatar, points: 0, played: 0, wins: 0,
      eats: 0, reports: 0, misses: 0, maxPenalty: 0, streak: 0, bestStreak: 0, comebacks: 0 });
  }
  return room.match;
}
function titleAwards(match) {
  const awards = [];
  for (const [key, title, minimum] of [['eats', '吃牌高手', 1], ['maxPenalty', '加倍掌柜', 4],
    ['bestStreak', '连胜掌柜', 2], ['comebacks', '反超王', 1]]) {
    const high = Math.max(0, ...match.ledger.map(p => p[key] || 0));
    if (high >= minimum) for (const p of match.ledger.filter(p => p[key] === high)) awards.push({ id: p.id, name: p.name, title });
  }
  for (const p of match.ledger) if (p.reports >= 3 && !p.misses) awards.push({ id: p.id, name: p.name, title: '报牌模范' });
  return awards;
}
function trackAction(room, event, reportSeat = null) {
  const match = ensureParty(room), player = room.players[reportSeat ?? event.seat];
  const entry = match.ledger.find(p => p.id === player?.id);
  if (!entry) return;
  if (reportSeat !== null) { entry.reports++; return; }
  if (event.type === 'eat') entry.eats++;
  if (event.type === 'play' && event.penalty) entry.maxPenalty = Math.max(entry.maxPenalty, event.penalty);
  for (const missed of event.reportPenalties || []) {
    const e = match.ledger.find(p => p.id === room.players[missed.seat]?.id);
    if (e && missed.count) e.misses++;
  }
  let text;
  if (event.type === 'eat') text = player.name + ' 整手吃 ' + event.target.rank;
  if (event.type === 'play' && event.penalty >= 8) text = player.name + ' 将罚摸叠至 +' + event.penalty;
  if (text) {
    match.highlights.push({ round: room.round.number, step: room.round.step, text, card: event.card || event.target,
      cards: event.type === 'eat' ? event.cards : [], id: entry.id });
    match.highlights = match.highlights.slice(-12);
  }
}
function settleMatch(room) {
  const match = ensureParty(room), round = room.round;
  if (!round?.result || match.lastRound === round.number) return false;
  match.lastRound = round.number;
  const before = Math.max(...match.ledger.map(p => p.points));
  const winner = room.players[round.result.winner];
  const oldWinner = match.ledger.find(p => p.id === winner?.id);
  const wasBehind = oldWinner && oldWinner.points < before;
  room.players.forEach((p, seat) => {
    const e = match.ledger.find(e => e.id === p.id);
    e.points += round.result.deltas[seat]; e.played++;
    if (round.result.winner === seat) { e.wins++; e.streak++; e.bestStreak = Math.max(e.bestStreak, e.streak); }
    else if (round.result.winner !== null) e.streak = 0;
  });
  if (wasBehind && oldWinner.points > Math.max(...match.ledger.filter(p => p !== oldWinner).map(p => p.points))) {
    oldWinner.comebacks++;
    match.highlights.push({ round: round.number, step: round.step, id: oldWinner.id, text: oldWinner.name + ' 反超成为第一名', cards: [] });
    match.highlights = match.highlights.slice(-12);
  }
  match.completed++;
  match.rounds.push({ number: round.number, winner: winner?.name || '流局', points: match.ledger.map(p => ({ id: p.id, name: p.name, points: p.points })) });
  match.rounds = match.rounds.slice(-32);
  match.finished = Boolean(match.limit && match.completed >= match.limit);
  match.awards = titleAwards(match);
  return true;
}
function resetClock(room, now, grace = 0) {
  room.turnDeadline = !room.paused && !room.ended && room.options.turnSeconds && room.round && !room.round.result ? now + grace + room.options.turnSeconds * 1000 : null;
}
function liftPause(room, now) {
  if (!room.paused) return;
  room.turnDeadline = room.paused.remaining === null ? null : now + room.paused.remaining;
  room.botAt = now + 1800;
  room.paused = null;
}
function resolveVote(room, now) {
  const vote = room.vote;
  if (!vote) return false;
  if (vote.no.length || vote.expires <= now) { room.vote = null; room.voteNotice = '投票未通过'; return true; }
  if (!vote.eligible.every(id => vote.yes.includes(id))) return false;
  if (vote.kind === 'pause') {
    room.paused = { until: now + 120000, remaining: room.turnDeadline ? Math.max(0, room.turnDeadline - now) : null };
    room.turnDeadline = null;
  } else {
    settleMatch(room);
    room.ended = true; room.paused = null; room.turnDeadline = null;
    room.match.finished = true; room.match.endedEarly = true;
    room.match.awards = titleAwards(room.match);
  }
  room.vote = null; room.voteNotice = vote.kind === 'pause' ? '全桌同意，暂停两分钟' : '全桌同意散桌，未完成本局不计分';
  return true;
}
module.exports = { PROTOCOL, ensureParty, trackAction, settleMatch, titleAwards, resetClock, liftPause, resolveVote };
