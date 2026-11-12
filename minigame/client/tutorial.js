'use strict';

const { createDeck, normalizeOptions, startRound, applyMove } = require('../shared/rules');

const lessons = [
  { title: '同花色接牌', instruction: '点选红桃 9，再点出牌，接上桌面的红桃 5。', top: ['heart', 5], hand: [['heart', 9], ['club', 4]],
    done: '同花色可以接，下一位继续按红桃或点数 9 接牌。', action: 'play' },
  { title: '同点数换花色', instruction: '桌面是梅花 6。用方块 6 接上，花色就变成方块。', top: ['club', 6], hand: [['diamond', 6], ['spade', 4]],
    done: '同点数也能接牌，后面按新打出的花色继续。', action: 'play' },
  { title: '没牌可接就摸一张', instruction: '两张牌都接不上方块 K，点「摸 1 张」。', top: ['diamond', 13], hand: [['club', 3], ['spade', 4]],
    done: '摸牌后回合立即结束，即使摸到能接的牌也不能马上出。', action: 'draw' },
  { title: '用 2 叠加罚牌', instruction: '上家出了 2。用你手上的 2 接上，把罚摸叠到 4 张。', top: ['heart', 2], hand: [['spade', 2], ['club', 5]], penalty: 2,
    done: '罚牌期间只能接 2；接不上时摸累计张数，然后过回合。', action: 'play' },
  { title: '8 可以变花色', instruction: '选中 8，点「出牌」，再选择并确认你想要的花色。', top: ['club', 13], hand: [['heart', 8], ['diamond', 4]],
    done: '8 可以指定花色，但罚摸 2 叠加期间不能用 8 解罚。', action: 'play' },
  { title: '整手点数相等就吃', instruction: '别人打出 9，你的整手 4 + 5 = 9。点吃牌，直接获胜。', top: ['club', 9], hand: [['heart', 4], ['diamond', 5]], turn: 1,
    done: '任何点数都能吃：必须整手牌合计相等，不用等回合，也不限花色。', action: 'eat' },
  { title: '剩一张记得报', instruction: '你只剩一张 A。先点「报牌」，再选中 A 出牌。', top: ['heart', 1], hand: [['spade', 1]],
    done: '剩一张要报！下一位完成有效出牌或摸牌仍漏报，会罚摸一张。', action: 'play' },
];

function createLesson(index) {
  const lesson = lessons[index];
  if (!lesson) throw new Error('教学关卡不存在');
  const options = normalizeOptions({ players: 2 });
  const round = startRound(options, 2);
  const deck = createDeck(1);
  const take = ([suit, rank]) => deck.splice(deck.findIndex(c => c.suit === suit && c.rank === rank), 1)[0];
  const hand = lesson.hand.map(take), top = take(lesson.top);
  Object.assign(round, { hands: [hand, [deck.pop(), deck.pop()]], deck, discard: [top], opening: null,
    lastPlayed: index === 6 ? null : 1, turn: lesson.turn ?? 0, penalty: lesson.penalty || 0, step: 1 });
  return { index, lesson, options, round, complete: false };
}

function lessonMove(tutorial, move) {
  if (tutorial.complete) return;
  applyMove(tutorial.round, 0, move, tutorial.options);
  if (move.type === tutorial.lesson.action) tutorial.complete = true;
}

module.exports = { lessons, createLesson, lessonMove };
