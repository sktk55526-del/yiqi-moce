'use strict';
const { C, Paint } = require('./paint');
const { THEMES, themeOf } = require('./themes');
const fmt = n => n > 0 ? '+' + n : String(n);
function header(game, text, detail) {
  const { paint: p, top } = game;
  p.icon('‹', 20, top + 4, () => game.back());
  p.heading(text, 195, top + 27);
  if (detail) p.text(detail, 195, top + 58, 12, C.muted, { max: 340 });
}
function scroll(game, height, render, bottomSpace = 20) {
  const p = game.paint, body = { x: 22, y: game.top + 80, w: 346, h: game.height - game.bottom - game.top - 80 - bottomSpace };
  const max = Math.max(0, height - body.h);
  game.rulesScroll = Math.min(max, Math.max(0, game.rulesScroll || 0));
  const firstHit = p.hits.length;
  p.ctx.save(); p.shape(body.x, body.y, body.w, body.h, 14); p.ctx.clip();
  render(body.y - game.rulesScroll, body);
  p.ctx.restore();
  p.hits = p.hits.slice(0, firstHit).concat(p.hits.slice(firstHit).flatMap(hit => {
    const y = Math.max(hit.y, body.y), end = Math.min(hit.y + hit.h, body.y + body.h);
    return end > y ? [{ ...hit, y, h: end - y }] : [];
  }));
  game.scrollZone = { ...body, type: 'rules', max };
}
function configureParty(game) {
  const { paint: p, busy, connecting } = game, editing = game.page === 'roomConfig';
  const o = editing ? game.roomDraft : game.options;
  header(game, editing ? '修改房间玩法' : '创建好友房', '整场、节奏与观战 · 向上滑动查看全部');
  scroll(game, 603, y => {
    p.panel(22, y, 346, 603);
    const groups = [
      ['桌位人数', 'players', [2, 3, 4, 5, 6], n => n + '人'],
      ['牌副数', 'decks', [1, 2, 3, 4], n => n + '副'],
      ['摸牌堆用完', 'exhaustion', ['shuffle', 'draw'], n => n === 'shuffle' ? '洗牌继续' : '直接流局'],
      ['好友整场赛', 'roundLimit', [0, 8, 16], n => n ? n + '局' : '自由局'],
      ['出牌节奏', 'turnSeconds', [0, 30, 60], n => n ? n + '秒' : '不限时'],
      ['断线自动托管', 'offlineAuto', [true, false], n => n ? '30秒后代打' : '等待本人'],
      ['候补观战席', 'spectators', [true, false], n => n ? '开放' : '关闭'],
    ];
    groups.forEach(([label, key, values, name], i) => {
      const row = y + 10 + i * 70;
      p.text(label, 43, row + 12, 14, C.ink, { align: 'left' });
      const gap = 8, w = (304 - gap * (values.length - 1)) / values.length;
      values.forEach((value, j) => p.button(name(value), 43 + j * (w + gap), row + 28, w, 34,
        editing && key === 'players' && value < game.room.players.length ? null : () => { o[key] = value; },
        o[key] === value ? 'primary' : 'paper'));
    });
    if (!editing) {
      p.text('你的名称', 43, y + 524, 13, C.ink, {align:'left'});
      p.text((game.nameEditing ? game.nameDraft : game.preferences.nickname) || '默认名称', 114, y + 524, 15, C.ink, {align:'left',max:140});
      p.button('修改', 278, y + 503, 64, 40, !busy && !game.nameEditing ? () => game.editNickname() : null,'paper');
    }
    p.text('流局计入局数 · 候补下一局入座 · 超时仅代出本回合', 195, y + 577, 10, '#6B694D');
  }, 82);
  p.button(editing ? '保存玩法 · 重新准备' : '创建房间', 39, game.height - game.bottom - 64, 312, 50,
    !busy && !connecting ? () => editing ? game.saveRoomOptions() : game.enterOnline('create') : null);
}
function party(game) {
  const { paint: p, room: r, busy } = game;
  if (!r) return;
  header(game, '茶桌事务', r.code ? '房间 ' + r.code : '人机练习');
  const buttons = [];
  if (r.match) buttons.push(
    ['整场排名 / 趣味称号', () => game.openPartyPage('matchBoard')],
    ['名场面战报', () => game.openPartyPage('warReport')]);
  buttons.push(['我的茶桌 / 牌背', () => game.openPartyPage('themes')]);
  if (r.round) buttons.push(['本局积分与明细', () => { game.open('scores'); }]);
  if (r.code && !r.watching && !r.ended) {
    buttons.push(['茶馆传声 / 表情', () => game.openSocial()]);
    if (r.paused) buttons.push(['恢复牌局', r.self === r.host ? () => game.send('unpause') : null]);
    else if (r.round && !r.round.result) buttons.push(['申请暂停两分钟', () => game.confirmVote('pause')]);
    buttons.push(['申请散桌（未完成本局不计分）', () => game.confirmVote('dissolve')]);
  }
  buttons.push([r.watching ? '退出观战' : '退出房间', () => { game.overlay = 'leave'; }]);
  scroll(game, 65 * buttons.length + 100, y => {
    p.panel(22, y, 346, 65 * buttons.length + 100);
    p.text('观战 ' + (r.spectators?.length || 0) + ' 人 · 候补 ' + (r.spectators?.filter(s => s.queued).length || 0) + ' 人', 195, y + 28, 14, C.ink);
    buttons.forEach(([label, action], i) => p.button(label, 40, y + 60 + i * 65, 310, 49, !busy ? action : null, i === buttons.length - 1 ? 'danger' : 'paper'));
  });
}
function spectator(game) {
  const { paint: p, room: r, top, height: h, bottom } = game;
  if (!r) return;
  header(game, '茶馆观战席', '房间 ' + r.code + ' · 仅展示公开信息');
  const y = top + 82, gap = Math.min(45, (h - bottom - y - 245) / r.players.length);
  p.panel(22, y, 346, h - bottom - y - 78);
  p.text(r.round ? '第 ' + r.round.number + ' 局' : '等待开局', 195, y + 28, 20, C.ink);
  if (r.round?.top) p.card(r.round.top, 167, y + 53, 56, 80);
  p.text(r.paused ? '牌桌暂停中' : r.round?.result ? '本局已结束' : r.round ? '轮到 ' + r.players[r.round.turn].name : '准备好就开桌', 195, y + 153, 14, C.ink);
  r.players.forEach((person, i) => {
    const row = y + 182 + i * gap;
    p.text(person.name + (person.released ? ' · 已放弃座位' : person.returnNextRound ? ' · 座位保留' : ''), 43, row, 13, C.ink, { align: 'left' });
    p.text((r.round?.handCounts[i] ?? 0) + '张 · ' + fmt(r.round?.scores[i] || 0) + '分', 345, row, 13, C.ink, { align: 'right' });
  });
  const note = r.queued ? '候补第 ' + r.queuePosition + ' 位 · 下一局有空位时入座' : '申请候补不会替换原玩家的保留座位';
  p.text(note, 195, h - bottom - 113, 11, C.ink);
  p.button(r.queued ? '取消候补' : '申请下一局入座', 23, h - bottom - 63, 225, 47,
    !game.busy ? () => game.send('queue', { enabled: !r.queued }) : null);
  p.button('桌务', 260, h - bottom - 63, 106, 47, () => game.openPartyPage('party'), 'secondary');
}
function matchBoard(game) {
  const { paint: p } = game, r = game.partyRecord || game.room, m = r?.match;
  header(game, m?.finished ? '整场战绩' : '整场排名', m ? '已完成 ' + m.completed + ' / ' + (m.limit || '自由') + ' 局 · 并列同分同名次' : '好友整场赛开局后生成');
  if (!m) return;
  const ranked = [...m.ledger].sort((a, b) => b.points - a.points);
  const awards = m.awards || [], recent = m.rounds.slice(-8);
  scroll(game, 105 + ranked.length * 62 + awards.length * 35 + recent.length * 36 + 100, y => {
    p.panel(22, y, 346, 105 + ranked.length * 62 + awards.length * 35 + recent.length * 36 + 100);
    p.text(m.finished ? (m.endedEarly ? '本场已提前结束' : '✦ 今晚的茶桌冠军 ✦') : '每一局，都能改写排名', 195, y + 30, 18, '#9B6D32');
    ranked.forEach((e, i) => {
      const row = y + 66 + i * 62, rank = ranked.findIndex(p => p.points === e.points) + 1;
      p.text(String(rank).padStart(2, '0'), 49, row, 21, '#9B6D32');
      p.text(e.name, 83, row - 3, 18, C.ink, { align: 'left' });
      p.text(e.wins + ' 胜 / ' + e.played + ' 局 · 吃牌 ' + e.eats + ' 次', 83, row + 19, 11, '#6B694D', { align: 'left' });
      p.text(fmt(e.points), 340, row, 22, e.points < 0 ? C.red : C.ink, { align: 'right' });
    });
    let row = y + 75 + ranked.length * 62;
    p.text('茶馆趣味称号', 195, row, 19, C.ink); row += 32;
    if (!awards.length) p.text('吃牌、连胜、准时报牌，赢取你的称号', 195, row, 12, '#6B694D');
    for (const a of awards) { p.text('✦ ' + a.name + ' · ' + a.title, 195, row, 16, '#9B6D32'); row += 35; }
    row += 45; p.text('最近各局领先记录', 195, row, 17, C.ink);
    for (const round of recent) {
      row += 36; const leaders = [...round.points].sort((a, b) => b.points - a.points);
      p.text('第' + round.number + '局 · ' + round.winner + ' · 领先 ' + leaders[0].name + ' ' + fmt(leaders[0].points), 195, row, 12, C.ink, { max: 300 });
    }
  }, 80);
  p.button('名场面战报', 24, game.height - game.bottom - 62, 170, 47, () => game.openPartyPage('warReport'));
  p.button(r.ended ? '回到大厅' : '返回', 204, game.height - game.bottom - 62, 162, 47,
    () => r.ended && !game.partyRecord ? game.leave() : game.back(), 'secondary');
}
function warReport(game) {
  const { paint: p, top } = game, r = game.partyRecord || game.room, m = r?.match;
  header(game, '名场面战报', '只含公开信息 · 可生成图片保存或分享');
  if (!m) { p.text('好友房对局后会生成战报', 195, top + 130, 18, C.cream); return; }
  const scenes = [...m.highlights].reverse();
  scroll(game, 125 + scenes.length * 133, y => {
    p.panel(22, y, 346, 125 + scenes.length * 133);
    p.text('一起抹车 · 今晚有好戏', 195, y + 28, 21, C.ink);
    p.text('已完成 ' + m.completed + ' 局 · ' + m.ledger.length + ' 位茶友', 195, y + 57, 13, '#6B694D');
    if (!scenes.length) p.text('精彩吃牌、叠加 +8、反超时自动记录', 195, y + 95, 12, '#6B694D');
    scenes.forEach((e, i) => {
      const row = y + 85 + i * 133;
      p.box(40, row, 310, 120, 12, '#F4E1B6', '#D6BC81');
      p.text('第 ' + e.round + ' 局 · ' + e.text, 195, row + 24, 15, C.ink, { max: 285 });
      const cards = e.cards?.length ? e.cards : e.card ? [e.card] : [];
      cards.slice(0, 6).forEach((c, j) => p.card(c, 195 - Math.min(6, cards.length) * 24 + j * 48, row + 44, 40, 57));
      if (!cards.length) p.text('追上来的这一刻，值得记住', 195, row + 75, 13, '#9B6D32');
    });
  }, 82);
  p.button('生成战报图片', 40, game.height - game.bottom - 64, 310, 48, () => game.exportReport());
}
function drawReportCard(canvas, room, theme) {
  canvas.width = 780; canvas.height = 1180;
  const p = new Paint(canvas), m = room.match;
  p.box(0, 0, 780, 1180, 0, p.gradient(0, 1180, theme.a, theme.b));
  p.box(32, 30, 716, 1120, 28, null, '#E9B551', 3);
  p.text('一起抹车', 390, 97, 52, C.light);
  p.text('茶馆战报 · 已完成 ' + m.completed + ' 局', 390, 157, 25, C.gold);
  const leaders = [...m.ledger].sort((a, b) => b.points - a.points).slice(0, 6);
  leaders.forEach((e, i) => {
    const y = 235 + i * 58;
    const rank = leaders.findIndex(p => p.points === e.points) + 1;
    p.text(rank + '  ' + e.name, 90, y, 27, C.cream, { align: 'left' });
    p.text(fmt(e.points) + ' 分', 680, y, 30, C.gold, { align: 'right' });
  });
  if (m.ledger.length > 6) p.text('展示积分前六位茶友', 390, 580, 18, C.muted);
  p.line(82, 620, 698, 620, '#A58B51', 2);
  const scenes = m.highlights.slice(-3);
  p.text('茶桌名场面', 390, 662, 29, C.gold);
  scenes.forEach((s, i) => p.text('第' + s.round + '局 · ' + s.text, 390, 711 + i * 47, 23, C.cream, { max: 610 }));
  if (!scenes.length) p.text('好朋友坐在一起，就是好牌局', 390, 741, 25, C.cream);
  (m.awards || []).slice(0, 3).forEach((a, i) => p.text('✦ ' + a.name + ' · ' + a.title, 390, 918 + i * 42, 24, C.gold));
  p.text('好友同桌 · 下次继续', 390, 1096, 22, C.muted);
}
function themes(game) {
  const { paint: p, preferences: prefs } = game;
  header(game, '我的茶桌', '12 款原创桌面 · 仅影响自己 · 向上滑动');
  const gridHeight = Math.ceil(THEMES.length / 2) * 232;
  scroll(game, gridHeight + 305, (y, body) => {
    THEMES.forEach((theme, i) => {
      const x = 22 + i % 2 * 179, row = y + Math.floor(i / 2) * 232;
      if (row + 222 < body.y || row > body.y + body.h) return;
      const selected = themeOf(prefs).id === theme.id;
      p.box(x, row, 167, 222, 12, theme.b, selected ? C.gold : '#647C73', selected ? 3 : 1);
      const image = game.themeImages?.get(theme, true);
      if (image) p.ctx.drawImage(image, x + 5, row + 5, 157, 168);
      else p.box(x + 5, row + 5, 157, 168, 8, p.gradient(row, 168, theme.a, theme.b));
      p.text(theme.name, x + 83, row + 185, 17, C.light);
      const failed = game.themeImages?.failed.has('table-' + theme.asset + '.jpg') || game.themeImages?.failed.has('thumb-' + theme.asset + '.jpg');
      p.text(failed ? '加载失败 · 点选重试' : selected ? '✓ 已选用' : '点击选用', x + 83, row + 207, 11, C.gold);
      p.hit(x, row, 167, 222, () => game.setAppearance('theme', theme.id));
    });
    const row = y + gridHeight;
    p.panel(22, row, 346, 290);
    p.text('牌背图案', 195, row + 26, 18, C.ink);
    [['flower','茶花'],['diamond','菱纹'],['tea','茶字']].forEach(([id, label], i) =>
      p.button(label, 40 + 105 * i, row + 49, 98, 42, () => game.setAppearance('cardBack', id), (prefs.cardBack || 'flower') === id ? 'primary' : 'paper'));
    [['largeCards','大字牌面'],['reducedMotion','减少动态效果'],['ambience','轻柔环境声']].forEach(([key, label], i) => {
      p.text(label, 45, row + 123 + i * 51, 17, C.ink, { align: 'left' });
      p.button(prefs[key] ? '开启' : '关闭', 263, row + 103 + i * 51, 66, 40, () => game.toggle(key), 'paper');
    });
  });
}
function themedBackground(game) {
  const theme = themeOf(game.preferences), p = game.paint, h = game.height;
  const reference=game.images[game.page==='table'?'ui-felt-background':'ui-clean-background'];
  if(theme.id==='tea'&&reference){
    p.ctx.drawImage(reference,0,0,390,h);
    return true;
  }
  p.box(0, 0, 390, h, 0, p.gradient(0, h, theme.a, theme.b));
  const image = game.themeImages?.get(theme);
  if (image) {
    p.ctx.drawImage(image,0,0,390,h);
  }
  return true;
}
module.exports = { configureParty, party, spectator, matchBoard, warReport, themes, themeOf, themedBackground, drawReportCard };
