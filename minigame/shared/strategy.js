'use strict';

const SUITS = ['spade', 'heart', 'club', 'diamond'];
const DIFFICULTIES = [
  { id: 'easy', name: '休闲', detail: '随机合法出牌，轻松熟悉玩法' },
  { id: 'normal', name: '标准', detail: '优先叠罚，按手牌花色衔接' },
  { id: 'hard', name: '进阶', detail: '考虑连牌、余牌分和对手剩牌数' },
];

// This interface deliberately accepts only a private round view, never opponents' hands/deck.
function chooseMove(view, seat, difficulty = 'normal', random = Math.random) {
  const hand = view.hand;
  if (hand.length === 1 && !view.reported?.[seat]) return { type: 'report' };
  if (view.canEat) return { type: 'eat' };
  const legal = hand.filter(c => view.legal.includes(c.id));
  if (!legal.length) return { type: 'draw' };
  let card, suit;
  const suitCount = (s, cards = hand) => cards.filter(c => c.suit === s && c.rank !== 8).length;
  if (difficulty === 'easy') {
    card = legal[Math.min(legal.length - 1, Math.floor(random() * legal.length))];
    suit = SUITS[Math.min(3, Math.floor(random() * 4))];
  } else if (difficulty === 'hard') {
    const next = (seat + 1) % view.handCounts.length;
    const danger = view.handCounts.some((n, i) => i !== seat && n <= 2);
    let best = -Infinity;
    for (const candidate of legal) {
      const rest = hand.filter(c => c.id !== candidate.id);
      const suits = candidate.rank === 8 ? SUITS : [candidate.suit];
      for (const nextSuit of suits) {
        const base = rest.reduce((n, c) => n + (c.rank === 8 ? 20 : c.rank), 0);
        const twos = rest.filter(c => c.rank === 2).length;
        const liability = Math.log2(1 + base * 2 ** twos);
        const links = rest.reduce((n, c, i) => n + rest.slice(i + 1).filter(d => c.rank === d.rank || c.suit === d.suit || c.rank === 8 || d.rank === 8).length, 0);
        const value = suitCount(nextSuit, rest) * 7 + links * 1.5 - liability * (danger ? 8 : 2)
          + (candidate.rank === 2 ? view.handCounts[next] <= 2 ? 42 : 10 : 0)
          + (candidate.rank === 8 && rest.length > 2 && !danger ? -13 : 0);
        if (value > best) { best = value; card = candidate; suit = nextSuit; }
      }
    }
  } else {
    const weight = c => c.rank === 2 ? 32 : c.rank === 8 ? 1 : suitCount(c.suit) * 5 + c.rank;
    card = legal.reduce((best, c) => weight(c) > weight(best) ? c : best);
    suit = SUITS.reduce((best, s) => suitCount(s) > suitCount(best) ? s : best);
  }
  return { type: 'play', cardId: card.id, ...(card.rank === 8 ? { suit } : {}) };
}

module.exports = { chooseMove, DIFFICULTIES };
