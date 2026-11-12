'use strict';
const { C, ranks, symbols } = require('./paint');
const { SUIT_NAMES } = require('../shared/rules');
const { DIFFICULTIES } = require('../shared/strategy');
const { recordStats } = require('./records');
const signed = n => n > 0 ? '+' + n : String(n);
const cardName = c => c ? symbols[c.suit] + ranks[c.rank] : '';
const dateText = stamp => {
  const d = new Date(stamp);
  return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
};

function header(game, label, detail) {
  const p = game.paint;
  p.icon('‹', 20, game.top + 4, () => game.back());
  p.heading(label, 195, game.top + 27);
  p.text(detail, 195, game.top + 58, 12, C.muted, { max: 340 });
}

function records(game) {
  const { paint: p, top, height: h, bottom } = game;
  header(game, '我的战绩', '仅保存在本机 · 最近 20 局 · 点记录回顾');
  if (game.records.length) p.icon('×', 326, top + 4, () => { game.overlay = 'clearRecords'; });
  const mode = game.recordMode === 'all' ? null : game.recordMode;
  const stats = recordStats(game.records, mode);
  const y = top + 82;
  p.panel(22, y, 346, 94);
  [['场次', stats.played], ['获胜', stats.wins], ['流局', stats.draws], ['净积分', signed(stats.points)]].forEach(([label, value], i) => {
    p.text(label, 67 + i * 85, y + 25, 12, '#5B6550');
    p.text(value, 67 + i * 85, y + 57, 25, C.ink, { max: 77 });
  });
  [['all', '全部'], ['friends', '好友房'], ['practice', '人机练习']].forEach(([id, label], i) => {
    p.button(label, 24 + i * 116, y + 110, 110, 40, () => { game.recordMode = id; game.rulesScroll = 0; }, game.recordMode === id ? 'primary' : 'secondary');
  });
  const body = { x: 22, y: y + 166, w: 346, h: Math.max(80, h - bottom - y - 184) };
  const rows = game.records.filter(r => !mode || r.mode === mode);
  if (!rows.length) {
    p.panel(body.x, body.y, body.w, Math.min(230, body.h));
    p.text('还没有完成的对局', 195, body.y + 65, 21, C.ink);
    p.text('打一局，留下你的第一份战绩', 195, body.y + 103, 13, '#5B6550');
    if (!game.room) p.button('去人机练习', 71, body.y + 140, 248, 46, () => game.open('practice'));
    return;
  }
  const max = Math.max(0, rows.length * 103 - body.h);
  game.rulesScroll = Math.min(max, game.rulesScroll);
  p.ctx.save(); p.shape(body.x, body.y, body.w, body.h, 8); p.ctx.clip();
  rows.forEach((record, index) => {
    const line = body.y + index * 103 - game.rulesScroll;
    if (line > body.y + body.h || line + 95 < body.y) return;
    const draw = record.result.winner === null, win = record.result.winner === record.self;
    const level = DIFFICULTIES.find(d => d.id === record.difficulty)?.name || '标准';
    p.panel(23, line, 344, 92);
    p.text(draw ? '流局' : win ? '获胜' : '惜败', 57, line + 28, 18, win ? '#236446' : draw ? '#77684B' : C.red);
    p.text(record.mode === 'friends' ? '好友房 · 第' + record.number + '局' : level + '练习 · 第' + record.number + '局', 94, line + 28, 15, C.ink, { align: 'left' });
    const delta = record.result.deltas[record.self];
    p.text(signed(delta), 340, line + 29, 20, delta >= 0 ? '#236446' : C.red, { align: 'right', max: 80 });
    p.text(dateText(record.savedAt) + ' · ' + record.players.length + '人 · ' + record.options.decks + '副牌', 43, line + 63, 12, '#5B6550', { align: 'left' });
    p.text('回顾 ›', 339, line + 63, 13, C.ink, { align: 'right' });
    const hitY = Math.max(line, body.y), hitEnd = Math.min(line + 92, body.y + body.h);
    if (hitEnd > hitY) p.hit(23, hitY, 344, hitEnd - hitY, () => game.openReplay(record));
  });
  p.ctx.restore();
  game.scrollZone = { ...body, type: 'rules', max };
}

function describeEvent(event, players) {
  const name = players[event.seat]?.name || '玩家';
  if (event.type === 'start') return (event.top ? '起始牌 ' + cardName(event.top) + '，' : '') + name + '先出';
  if (event.type === 'report') return name + '报牌：剩一张！';
  if (event.type === 'draw') return name + (event.requested > 1 ? '罚摸 ' : '摸 ') + event.count + ' 张' + (event.recycled ? ' · 已重新洗牌' : '');
  if (event.type === 'eat') return name + '吃 ' + cardName(event.target) + '：' + event.cards.map(c => c.rank).join(' + ') + ' = ' + event.target.rank;
  let text = name + '打出 ' + cardName(event.card);
  if (event.suit) text += '，改为' + SUIT_NAMES[event.suit];
  if (event.penalty) text += '，累计罚摸 ' + event.penalty + ' 张';
  return text;
}

function replay(game) {
  const { paint: p, top, height: h, bottom, replayRecord: record } = game;
  const history = record.history || [];
  const index = Math.max(0, Math.min(game.replayIndex, history.length - 1));
  const entry = history[index];
  header(game, '牌局回顾', '第 ' + record.number + ' 局 · ' + (history.length ? index + 1 : 0) + '/' + history.length + ' 条公开动作');
  const y = top + 82, panelH = Math.max(360, h - bottom - y - 141);
  p.panel(22, y, 346, panelH);
  if (!entry) {
    p.text('这局没有回顾数据', 195, y + 75, 20, C.ink);
    p.text('新版完成的对局会自动记录', 195, y + 110, 13, '#5B6550');
  } else {
    p.text('动作 ' + entry.sequence + (record.historyCount > history.length ? ' · 仅保留最后 120 条' : ''), 195, y + 24, 12, '#5B6550');
    p.card(entry.top, 157, y + 48, 76, 106, entry.top ? '' : 'empty');
    p.wrap(describeEvent(entry, record.players), 45, y + 181, 300, 16, C.ink, 23);
    let notes = entry.reportPenalties?.filter(n => n.count).map(n => record.players[n.seat].name + '漏报，罚摸一张').join('；');
    if (!notes) notes = entry.chosenSuit ? '当前指定花色：' + SUIT_NAMES[entry.chosenSuit] : '公开余牌数 · 手牌内容不在回顾中展示';
    p.text(notes, 195, y + 234, 11, '#7A5837', { max: 300 });
    const rowsY = y + 257;
    record.players.forEach((player, seat) => {
      const x = 42 + seat % 2 * 156, line = rowsY + Math.floor(seat / 2) * 36;
      p.box(x, line, 149, 30, 8, seat === entry.seat ? '#E4C172' : '#F4E4BE', '#C7AD78');
      p.text(player.name + (seat === record.self ? '（你）' : '') + ' · ' + (entry.counts?.[seat] ?? '?') + '张', x + 75, line + 15, 12, C.ink);
    });
    if (panelH > 500) {
      const nearbyY = y + panelH - 122;
      p.line(44, nearbyY - 6, 346, nearbyY - 6, '#C9B58B');
      p.text('附近动作 · 点按跳转', 45, nearbyY + 12, 12, '#5B6550', { align: 'left' });
      const first = Math.max(0, Math.min(index - 1, history.length - 3));
      history.slice(first, first + 3).forEach((item, i) => {
        const line = nearbyY + 42 + i * 27;
        p.text((first + i === index ? '› ' : '  ') + item.sequence + '  ' + describeEvent(item, record.players), 45, line, 12,
          first + i === index ? C.red : C.ink, { align: 'left', max: 298 });
        p.hit(43, line - 12, 302, 26, () => game.replayStep(first + i - index));
      });
    }
  }
  const controlY = h - bottom - 119;
  p.button('上一步', 28, controlY, 102, 46, index > 0 ? () => game.replayStep(-1) : null, 'secondary');
  p.button(game.replayPlaying ? '暂停' : '自动播放', 140, controlY, 110, 46, history.length > 1 ? () => game.toggleReplay() : null);
  p.button('下一步', 260, controlY, 102, 46, index < history.length - 1 ? () => game.replayStep(1) : null, 'secondary');
  p.text('回到开头', 79, controlY + 77, 13, C.cream); p.hit(28, controlY + 55, 102, 42, () => game.replayStep(-history.length));
  p.text('算分明细', 195, controlY + 77, 13, C.cream);
  if (record.result?.details) p.hit(140, controlY + 55, 110, 42, () => game.scoreDetail(record.self));
  p.text('最后一步', 310, controlY + 77, 13, C.cream); p.hit(260, controlY + 55, 102, 42, () => game.replayStep(history.length));
}

module.exports = { records, replay, describeEvent };
