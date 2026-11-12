'use strict';

const SUITS = ['spade', 'heart', 'club', 'diamond'];
const SUIT_NAMES = { spade: '黑桃', heart: '红桃', club: '梅花', diamond: '方块' };
const MAX_PLAYERS = 6;
const MAX_DECKS = 4;
const HAND_SIZE = 5;
const { chooseMove } = require('./strategy');
const HISTORY_LIMIT = 120;

function recordEvent(round, event) {
  round.history ??= [];
  round.historyCount = (round.historyCount || 0) + 1;
  // Only public actions. Drawn cards and private hands are intentionally excluded.
  const entry = { sequence: round.historyCount, step: round.step, type: event.type, seat: event.seat,
    counts: round.hands.map(hand => hand.length), penalty: round.penalty, chosenSuit: round.chosenSuit,
    top: round.discard[round.discard.length - 1] || null };
  for (const key of ['card', 'target', 'cards', 'count', 'requested', 'recycled', 'suit', 'reportPenalties']) {
    if (event[key] !== undefined) entry[key] = event[key];
  }
  round.history.push(entry);
  if (round.history.length > HISTORY_LIMIT) round.history.splice(0, round.history.length - HISTORY_LIMIT);
}

class RuleError extends Error {}

function demand(condition, message) {
  if (!condition) throw new RuleError(message);
}

function normalizeOptions(options = {}) {
  demand(options && typeof options === 'object' && !Array.isArray(options), '房间设置无效');
  const { players = 4, decks = 1, exhaustion = 'shuffle', offlineAuto = true, roundLimit = 0, turnSeconds = 0, spectators = true } = options;
  demand(Number.isInteger(players) && players >= 2 && players <= MAX_PLAYERS, '人数应为 2 至 6 人');
  demand(Number.isInteger(decks) && decks >= 1 && decks <= MAX_DECKS, '牌副数应为 1 至 4 副');
  demand(exhaustion === 'shuffle' || exhaustion === 'draw', '请选择牌堆用完时的处理方式');
  demand(typeof offlineAuto === 'boolean', '托管设置无效');
  demand([0, 8, 16].includes(roundLimit), '整场局数应为自由局、8 局或 16 局');
  demand([0, 30, 60].includes(turnSeconds), '出牌时间应为不限时、30 秒或 60 秒');
  demand(typeof spectators === 'boolean', '观战设置无效');
  return { players, decks, exhaustion, offlineAuto, roundLimit, turnSeconds, spectators };
}

function createDeck(decks) {
  const cards = [];
  for (let copy = 0; copy < decks; copy++) {
    for (const suit of SUITS) {
      for (let rank = 1; rank <= 13; rank++) cards.push({ id: copy + '-' + suit + '-' + rank, suit, rank });
    }
  }
  return cards;
}

function shuffle(cards, random = Math.random) {
  for (let index = cards.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [cards[index], cards[other]] = [cards[other], cards[index]];
  }
  return cards;
}

function scoreHand(hand) {
  return scoreBreakdown(hand).points;
}

function scoreBreakdown(hand) {
  let points = 0;
  let doubles = 0;
  for (const { rank } of hand) {
    points += rank === 8 ? 20 : rank;
    if (rank === 2) doubles++;
  }
  return { cards: hand.map(card => ({ ...card })), values: hand.map(card => card.rank === 8 ? 20 : card.rank),
    base: points, doubles, multiplier: 2 ** doubles, points: points * (2 ** doubles) };
}

function nextSeat(seat, size) {
  return (seat + 1) % size;
}

function countStarter(dealer, rank, size) {
  return (dealer + rank - 1) % size;
}

function startRound(options, size, previous = null, random = Math.random) {
  demand(Number.isInteger(size) && size >= 2 && size <= options.players, '人数不足或超过房间上限');
  demand(!previous || previous.result, '本局还未结束');
  const deck = shuffle(createDeck(options.decks), random);
  const hands = Array.from({ length: size }, () => []);
  const number = previous ? previous.number + 1 : 1;
  const dealer = previous ? nextSeat(previous.dealer, size) : 0;
  for (let index = 0; index < HAND_SIZE; index++) {
    for (let offset = 1; offset <= size; offset++) hands[(dealer + offset) % size].push(deck.pop());
  }
  const opening = previous ? null : deck.pop();
  const starter = previous ? previous.result.nextStarter : countStarter(dealer, opening.rank, size);
  const round = {
    number, dealer, starter, opening, turn: starter, deck, hands, startedAt: Date.now(),
    discard: opening ? [opening] : [], penalty: 0, chosenSuit: null,
    lastPlayed: null, result: null, reported: Array(size).fill(false),
    scores: previous ? previous.scores.slice() : Array(size).fill(0),
    stats: Array.from({ length: size }, (_, seat) => ({ played: 0, wins: 0, streak: 0, bestStreak: 0, ...previous?.stats?.[seat] })),
    event: { type: 'start', seat: starter }, step: 0,
  };
  recordEvent(round, { type: 'start', seat: starter });
  return round;
}

function legalCards(round, seat) {
  if (round.result || round.turn !== seat) return [];
  const top = round.discard[round.discard.length - 1];
  return round.hands[seat].filter(card => {
    if (round.penalty) return card.rank === 2;
    if (card.rank === 8) return true;
    if (round.chosenSuit) return card.suit === round.chosenSuit;
    return !top || card.suit === top.suit || card.rank === top.rank;
  });
}

function canEat(round, seat) {
  if (round.result || round.lastPlayed == null || round.lastPlayed === seat) return false;
  const top = round.discard[round.discard.length - 1];
  return Boolean(top && round.hands[seat].reduce((total, card) => total + card.rank, 0) === top.rank);
}

function needsReport(round, seat) {
  return !round.result && round.hands[seat].length === 1 && !round.reported?.[seat];
}

function endRound(round, winner) {
  const deltas = round.hands.map((hand, seat) => winner === null || seat === winner ? 0 : -scoreHand(hand));
  if (winner !== null) deltas[winner] = -deltas.reduce((sum, points) => sum + points, 0);
  round.scores = round.scores.map((score, seat) => score + deltas[seat]);
  round.stats = round.hands.map((_, seat) => {
    const old = round.stats?.[seat] || { played: 0, wins: 0, streak: 0, bestStreak: 0 };
    const streak = winner === null ? old.streak : winner === seat ? old.streak + 1 : 0;
    return { played: old.played + 1, wins: old.wins + (winner === seat ? 1 : 0), streak, bestStreak: Math.max(old.bestStreak, streak) };
  });
  round.result = { winner, deltas, details: round.hands.map(scoreBreakdown), nextStarter: winner ?? round.lastPlayed ?? round.starter };
}

function prepareDeck(round, options, random) {
  if (round.deck.length) return true;
  if (options.exhaustion === 'shuffle' && round.discard.length > 1) {
    round.deck = shuffle(round.discard.splice(0, round.discard.length - 1), random);
    return true;
  }
  return false;
}

function draw(round, seat, options, random) {
  const count = round.penalty || 1;
  let drawn = 0;
  let exhausted = false;
  let recycled = false;
  while (drawn < count) {
    const empty = !round.deck.length;
    if (!prepareDeck(round, options, random)) {
      exhausted = true;
      break;
    }
    recycled ||= empty;
    round.hands[seat].push(round.deck.pop());
    drawn++;
  }
  if (drawn && round.reported) round.reported[seat] = false;
  if (!round.deck.length) {
    if (prepareDeck(round, options, random)) recycled = true;
    else exhausted = true;
  }
  round.penalty = 0;
  round.event = { type: 'draw', seat, count: drawn, requested: count, recycled };
  if (exhausted) endRound(round, null);
  else round.turn = nextSeat(seat, round.hands.length);
}

function applyMove(round, seat, move, options, random = Math.random) {
  demand(!round.result, '本局已经结束');
  if (move?.type === 'report') {
    demand(round.hands[seat].length === 1, '只剩一张牌时才能报牌');
    round.reported ??= Array(round.hands.length).fill(false);
    if (round.reported[seat]) return;
    round.reported[seat] = true;
    recordEvent(round, { type: 'report', seat });
    return;
  }
  demand(move && ['play', 'draw', 'eat'].includes(move.type), '无法识别这次操作');
  if (move.type !== 'eat') demand(round.turn === seat, '还没轮到你');
  const legal = legalCards(round, seat);
  // A report is allowed until the next player's valid turn action completes.
  // Snapshot first so somebody newly reduced to one card gets a full grace turn.
  const missed = round.turn === seat ? round.hands.map((_, index) => index)
    .filter(index => nextSeat(index, round.hands.length) === seat && needsReport(round, index)) : [];
  let winner = null;

  if (move.type === 'draw') {
    demand(!legal.length && !canEat(round, seat), round.penalty ? '你有 2 可以接罚' : '手上有可以出的牌或可以吃牌');
    draw(round, seat, options, random);
  } else if (move.type === 'eat') {
    demand(canEat(round, seat), '整手牌的点数总和必须等于其他玩家打出的顶牌');
    demand(!needsReport(round, seat), '请先报牌，再打出最后一张');
    const target = round.discard[round.discard.length - 1];
    const cards = round.hands[seat].splice(0);
    round.discard.push(...cards);
    round.lastPlayed = seat;
    round.chosenSuit = null;
    round.penalty = 0;
    round.event = { type: 'eat', seat, target, cards };
    winner = seat;
  } else {
    const card = legal.find(item => item.id === move.cardId);
    demand(card, round.penalty ? '罚摸期间只能接 2' : '这张牌接不上');
    demand(!needsReport(round, seat), '请先报牌，再打出最后一张');
    if (card.rank === 8) demand(SUITS.includes(move.suit), '请选择有效花色');
    const hand = round.hands[seat];
    hand.splice(hand.indexOf(card), 1);
    round.discard.push(card);
    round.lastPlayed = seat;
    round.chosenSuit = card.rank === 8 ? move.suit : null;
    round.penalty = card.rank === 2 ? round.penalty + 2 : 0;
    round.event = { type: 'play', seat, card, penalty: round.penalty, suit: round.chosenSuit };
    if (!hand.length) winner = seat;
    else round.turn = nextSeat(seat, round.hands.length);
  }
  if (missed.length && !round.result) {
    const penalties = [];
    for (const target of missed) {
      const empty = !round.deck.length;
      let recycled = false;
      let count = 0;
      if (prepareDeck(round, options, random)) {
        recycled = empty;
        round.hands[target].push(round.deck.pop());
        count = 1;
        if (round.reported) round.reported[target] = false;
      }
      penalties.push({ seat: target, count, requested: 1, recycled, reason: 'missed-report' });
      if (!round.deck.length) {
        if (prepareDeck(round, options, random)) penalties[penalties.length - 1].recycled = true;
        else if (winner === null) { endRound(round, null); break; }
      }
    }
    round.event.reportPenalties = penalties;
  }
  if (winner !== null) endRound(round, winner);
  round.step++;
  recordEvent(round, round.event);
}

function roundView(round, seat) {
  if (!round) return null;
  return {
    number: round.number, dealer: round.dealer, starter: round.starter, opening: round.opening, startedAt: round.startedAt,
    turn: round.turn, deckCount: round.deck.length, top: round.discard[round.discard.length - 1] || null,
    hand: seat >= 0 ? round.hands[seat].slice() : [], handCounts: round.hands.map(hand => hand.length),
    reported: round.hands.map((hand, index) => hand.length === 1 && Boolean(round.reported?.[index])),
    legal: seat >= 0 ? legalCards(round, seat).map(card => card.id) : [], canEat: seat >= 0 && canEat(round, seat), penalty: round.penalty,
    chosenSuit: round.chosenSuit, scores: round.scores.slice(), result: round.result,
    stats: (round.stats || []).map(item => ({ ...item })),
    event: round.event, step: round.step,
    // During play transmit only the latest action; the full review is delivered once at settlement.
    history: (round.result ? round.history || [] : (round.history || []).slice(-1)).map(entry => ({ ...entry })), historyCount: round.historyCount || 0,
  };
}

function botMove(round, seat, difficulty = 'normal', random = Math.random) {
  return chooseMove(roundView(round, seat), seat, difficulty, random);
}

module.exports = { SUITS, SUIT_NAMES, HAND_SIZE, RuleError, normalizeOptions, createDeck, shuffle, scoreHand, scoreBreakdown,
  countStarter, startRound, legalCards, canEat, applyMove, roundView, botMove };
