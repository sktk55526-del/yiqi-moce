'use strict';
const { createDeck, normalizeOptions, startRound, applyMove, roundView, botMove, canEat } = require('./rules');
const KEY = 'moce.challenges.v1';
const puzzles = [
  { id: 'eat-nine', title: '一口吃清', theme: '整手吃牌', limit: 1,
    hint: '吃牌看整手点数之和，花色和回合都不限制。',
    top: ['club', 9], hand: [['heart', 4], ['diamond', 5]], other: [['spade', 11], ['heart', 12]], turn: 1 },
  { id: 'change-path', title: '换条出路', theme: '8 的花色选择', limit: 2,
    hint: '出 8 时指定剩余手牌的花色；剩一张后记得报。',
    top: ['club', 13], hand: [['heart', 8], ['spade', 3]], other: [['club', 6], ['diamond', 7]] },
  { id: 'double-back', title: '加倍奉还', theme: '2 的叠加', limit: 2,
    hint: '先用 2 把罚摸叠到 4 张，再报牌，为最后一张铺路。', penalty: 2,
    top: ['heart', 2], hand: [['spade', 2], ['spade', 3]], other: [['heart', 6], ['club', 7]] },
  { id: 'same-rank', title: '借点过桥', theme: '同点数换花色', limit: 2,
    hint: '用相同点数换成方块，下一张就能接上。',
    top: ['club', 6], hand: [['diamond', 6], ['diamond', 4]], other: [['spade', 5], ['heart', 7]] },
  { id: 'eat-king', title: '十三点绝杀', theme: '整手合计', limit: 1,
    hint: 'K 是 13，手上的 8 吃牌时仍按点数 8 计算。',
    top: ['spade', 13], hand: [['heart', 8], ['club', 3], ['diamond', 2]], other: [['club', 11], ['heart', 12]], turn: 1 },
  { id: 'report-first', title: '最后一声报', theme: '报牌后收官', limit: 1,
    hint: '一张牌先报，再用同点数接上，别急着直接出。',
    top: ['heart', 7], hand: [['club', 7]], other: [['spade', 11], ['diamond', 12]] },
];
function seeded(seed) {
  let value = 2166136261;
  for (const ch of String(seed)) value = Math.imul(value ^ ch.charCodeAt(0), 16777619);
  return () => { value += 0x6D2B79F5; let t = value; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function dayKey(now = Date.now()) { return new Date(now + 8 * 3600000).toISOString().slice(0, 10); }
function createChallenge(id) {
  const definition = puzzles.find(p => p.id === id);
  if (!definition) throw new Error('关卡不存在');
  const random = seeded(id), options = normalizeOptions({ players: 2 });
  const round = startRound(options, 2, null, random), deck = createDeck(1);
  const take = ([suit, rank]) => deck.splice(deck.findIndex(c => c.suit === suit && c.rank === rank), 1)[0];
  const hand = definition.hand.map(take), other = definition.other.map(take), top = take(definition.top);
  Object.assign(round, { hands: [hand, other], deck, discard: [top], opening: null, lastPlayed: 1,
    turn: definition.turn || 0, penalty: definition.penalty || 0, step: 1, history: [], historyCount: 0,
    event: { type: 'play', seat: 1, card: top, penalty: definition.penalty || 0 } });
  return { definition, options, round, random, moves: 0, complete: false, failed: false, hinted: false, log: [] };
}
function challengeMove(task, move) {
  if (task.complete || task.failed) return;
  applyMove(task.round, 0, move, task.options, task.random);
  if (move.type !== 'report') task.moves++;
  task.log = [task.round.event];
  let guard = 0;
  // Leave an out-of-turn eat opportunity in the player's hands, rather than racing the AI.
  while (!task.round.result && task.round.turn !== 0 && !canEat(task.round, 0)
    && !(task.round.hands[0].length === 1 && !task.round.reported[0]) && guard++ < 8) {
    const seat = task.round.turn;
    applyMove(task.round, seat, botMove(task.round, seat, 'normal', task.random), task.options, task.random);
    task.log.push(task.round.event);
  }
  task.complete = task.round.result?.winner === 0 && task.moves <= task.definition.limit;
  task.failed = !task.complete && (Boolean(task.round.result) || task.moves >= task.definition.limit);
}
function dailyRound(date = dayKey()) {
  const options = normalizeOptions({ players: 4, decks: 1 });
  const random = seeded('moce-daily-v1:' + date);
  return { options, random, round: startRound(options, 4, null, random), date, difficulty: 'hard' };
}
function readProgress(raw) {
  const result = { puzzles: {}, days: {} };
  if (!raw || typeof raw !== 'object') return result;
  for (const p of puzzles) {
    const value = raw.puzzles?.[p.id];
    if (value && Number.isInteger(value.stars) && value.stars >= 1 && value.stars <= 3) result.puzzles[p.id] = { stars: value.stars };
  }
  for (const date of Object.keys(raw.days || {}).filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort().slice(-31)) {
    const v = raw.days[date];
    if (v && Number.isInteger(v.attempts) && v.attempts > 0 && Number.isFinite(v.best)) {
      result.days[date] = { attempts: Math.min(v.attempts, 99999), best: v.best, won: v.won === true };
    }
  }
  return result;
}
module.exports = { KEY, puzzles, seeded, dayKey, createChallenge, challengeMove, dailyRound, readProgress };
