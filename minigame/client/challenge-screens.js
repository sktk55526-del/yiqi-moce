'use strict';
const { C, symbols, ranks } = require('./paint');
const { puzzles, dayKey } = require('../shared/challenges');
const { SUIT_NAMES } = require('../shared/rules');
const { REACTIONS } = require('../shared/social');
const cardText = c => symbols[c.suit] + ranks[c.rank];
function header(game, label, detail) {
  const p = game.paint;
  p.icon('‹', 20, game.top + 4, () => game.back());
  p.heading(label, 195, game.top + 27);
  p.text(detail, 195, game.top + 58, 12, C.muted, { max: 336 });
}
function challenges(game) {
  const { paint: p, top, height: h, bottom } = game;
  header(game, '茶馆练功房', '残局动脑 · 每日练习 · 进度保存在本机');
  const y = top + 82, date = dayKey(), day = game.progress.days[date];
  p.panel(22, y, 346, 150);
  p.text('每日同牌挑战', 45, y + 30, 21, C.ink, { align: 'left' });
  p.text(date + ' · 北京时间', 45, y + 58, 12, '#6B694D', { align: 'left' });
  p.text(day ? '完成 ' + day.attempts + ' 次 · 最佳 ' + day.best + ' 分' + (day.won ? ' · 已获胜' : '') : '4 人标准牌局 · 进阶电脑 · 同日同牌', 45, y + 82, 12, C.ink, { align: 'left', max: 300 });
  p.button(day ? '再练今日牌局' : '开始今日练习', 44, y + 101, 302, 37, () => game.startDaily());
  p.text('残局挑战 · ' + Object.keys(game.progress.puzzles).length + ' / ' + puzzles.length + ' 已通关', 195, y + 179, 16, C.cream);
  const body = { x: 22, y: y + 204, w: 346, h: h - bottom - y - 213 };
  const max = Math.max(0, puzzles.length * 94 - body.h);
  game.rulesScroll = Math.min(max, game.rulesScroll);
  p.ctx.save(); p.shape(body.x, body.y, body.w, body.h, 12); p.ctx.clip();
  puzzles.forEach((item, index) => {
    const row = body.y + index * 94 - game.rulesScroll;
    if (row + 86 < body.y || row > body.y + body.h) return;
    p.panel(23, row, 344, 85);
    p.text(String(index + 1).padStart(2, '0'), 54, row + 29, 20, '#9B6D32');
    p.text(item.title, 82, row + 28, 19, C.ink, { align: 'left' });
    const stars = game.progress.puzzles[item.id]?.stars || 0;
    p.text(stars ? '★'.repeat(stars) : '挑战 ›', 338, row + 29, 15, stars ? '#A46C20' : '#456047', { align: 'right' });
    p.text(item.theme + ' · ' + item.limit + ' 次出牌内获胜', 45, row + 60, 12, '#6B694D', { align: 'left' });
    const hitY = Math.max(body.y, row), end = Math.min(body.y + body.h, row + 85);
    p.hit(23, hitY, 344, end - hitY, () => game.startChallenge(item.id));
  });
  p.ctx.restore(); game.scrollZone = { ...body, type: 'rules', max };
}
function challenge(game) {
  const { paint: p, top, height: h, bottom, challenge: task, room, selected } = game;
  const { definition: d, round, complete, failed } = task, view = room.round;
  header(game, d.title, d.theme + ' · ' + task.moves + ' / ' + d.limit + ' 次出牌（报牌不计次数）');
  const y = top + 82, panelH = h - bottom - y - 82;
  p.panel(22, y, 346, panelH);
  p.text(complete ? '通关！ ' + '★'.repeat(task.hinted ? 2 : 3) : failed ? '差一点，换个思路再试' : '目标：' + d.limit + ' 次出牌内清空手牌', 195, y + 30, 19, complete ? '#236446' : failed ? C.red : C.ink, { max: 300 });
  p.text('搭档明牌：' + round.hands[1].map(cardText).join('  '), 195, y + 62, 13, '#6B694D', { max: 300 });
  p.text('残局为明牌练习，使用正常出牌规则', 195, y + 84, 11, '#6B694D');
  const cardY = y + 105;
  p.card(view.top, 165, cardY, 60, 85);
  p.text(view.chosenSuit ? '指定 ' + SUIT_NAMES[view.chosenSuit] : view.penalty ? '累计罚摸 ' + view.penalty + ' 张' : '桌面顶牌', 195, cardY + 104, 13, C.ink);
  const handY = y + Math.max(237, panelH - 181);
  if (handY - cardY > 235) {
    const infoY = cardY + 143, infoH = Math.min(144, handY - infoY - 37);
    p.box(43, infoY, 304, infoH, 15, '#F4E2B8', '#D8BF88');
    p.text(complete ? '★  挑战完成  ★' : failed ? '换个思路，再来一次' : '这一手，由你决定', 195, infoY + 26, 18, complete ? '#A46C20' : C.ink);
    const last = task.log.find(e => e.type === 'eat') || task.log[task.log.length - 1];
    const message = last?.type === 'eat' ? last.cards.map(c => c.rank).join(' + ') + ' = ' + last.target.rank + '，整手吃清'
      : last?.type === 'draw' ? '搭档摸了 ' + last.count + ' 张，轮到你出牌'
      : complete ? '剩牌清空，报牌与出牌都完成了' : '不看提示通关得三星，使用提示得两星';
    p.wrap(message, 59, infoY + 60, 272, 13, '#6B694D', 21);
    if (infoH > 110 && !complete && !failed) p.text(view.hand.length === 1 && !view.reported[0] ? '只剩一张，先按「报牌」' : view.canEat ? '此刻可以吃牌，仔细算一算' : '点选手牌后，再确认出牌', 195, infoY + 111, 12, C.ink);
  }
  p.text(complete ? '整手出完，挑战完成' : '你的手牌 · 点选后出牌', 195, handY - 19, 12, C.ink);
  const gap = Math.min(72, 292 / Math.max(1, view.hand.length)), first = (390 - (view.hand.length - 1) * gap - 60) / 2;
  view.hand.forEach((card, i) => {
    const x = first + i * gap;
    p.card(card, x, handY - (selected === card.id ? 6 : 0), 60, 83, selected === card.id ? 'selected' : view.legal.includes(card.id) ? 'legal' : '');
    if (!complete && !failed) p.hit(x, handY - 6, 60, 89, () => game.select(card.id));
  });
  const actionY = y + panelH - 58;
  if (!complete && !failed) {
    const report = view.hand.length === 1 && !view.reported[0];
    p.button(view.canEat ? '吃牌' : '摸 ' + (view.penalty || 1) + ' 张', 42, actionY, 142, 44,
      view.canEat && !report ? () => game.eat() : !view.canEat && !view.legal.length && view.turn === 0 ? () => game.draw() : null, 'paper');
    p.button(report ? '报牌' : '出牌', 196, actionY, 152, 44, report ? () => game.report() : selected ? () => game.playSelected() : null);
  } else p.text(complete ? (task.hinted ? '使用提示通关 · 再试一次争取三星' : '独立通关 · 三星已保存') : d.hint, 195, actionY + 22, 12, C.ink, { max: 304 });
  p.button('重新挑战', 26, h - bottom - 60, 107, 45, () => game.startChallenge(d.id), 'secondary');
  p.button('返回关卡', 142, h - bottom - 60, 107, 45, () => game.openChallenges(), 'secondary');
  p.button('看提示', 258, h - bottom - 60, 106, 45, !complete && !failed ? () => game.challengeHint() : null, 'paper');
}
function socialOverlay(game) {
  const { paint: p, height: h } = game;
  const y = Math.max(game.top + 75, h / 2 - 165);
  p.panel(22, y, 346, 330);
  p.text('茶馆传声', 195, y + 32, 23, C.ink);
  p.text('预设短句 · 每 6 秒一次 · 设置可静音', 195, y + 61, 12, '#6B694D');
  REACTIONS.forEach((item, i) => {
    const x = 40 + (i % 2) * 159, row = y + 84 + Math.floor(i / 2) * 63;
    p.box(x, row, 151, 55, 12, '#FFF1CF', '#C5AF80');
    p.circle(x + 24, row + 27, 16, item.color);
    p.text(item.icon, x + 24, row + 27, 17, C.ink);
    p.text(game.preferences.voice === 'yue' ? item.text : item.mandarin, x + 95, row + 27, 12, C.ink, { max: 100 });
    p.hit(x, row, 151, 55, () => game.sendReaction(item.id));
  });
  p.button('收起', 41, y + 280, 308, 37, () => { game.overlay = null; }, 'secondary');
}
function socialBubbles(game, now) {
  if (!['room', 'table', 'result'].includes(game.page) || !game.preferences.reactions) return;
  const p = game.paint;
  game.reactions.slice(-2).forEach((event, i) => {
    const item = REACTIONS.find(r => r.id === event.id), name = game.room?.players[event.seat]?.name;
    if (!item || !name) return;
    const age = now - event.at;
    const fade = game.preferences.reducedMotion ? 1 : Math.min(1, age / 160, (4000 - age) / 350);
    p.ctx.save(); p.ctx.globalAlpha = Math.max(0, fade);
    const y = game.top + 83 + i * 48;
    p.box(67, y, 256, 41, 16, '#FFF0CC', C.gold, 2);
    p.circle(88, y + 20, 14, item.color);
    p.text(item.icon, 88, y + 20, 15, C.ink);
    p.text(name + '：' + (game.preferences.voice === 'yue' ? item.text : item.mandarin), 205, y + 20, 13, C.ink, { max: 211 });
    p.ctx.restore();
  });
}
module.exports = { challenges, challenge, socialOverlay, socialBubbles };
