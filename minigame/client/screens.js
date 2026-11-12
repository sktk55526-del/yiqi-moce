'use strict';
const { SUITS } = require('../shared/rules');
const { suitName } = require('./voice');
const { C, symbols, ranks } = require('./paint');
const copy = require('./copy');
const { lessons } = require('./tutorial');
const { DIFFICULTIES } = require('../shared/strategy');
const { records, replay } = require('./feature-screens');
const VERSION = require('../shared/version');
const partyViews = require('./party-screens');
const { drawFidelity } = require('./fidelity-screens');
const { drawReference,views:referenceViews } = require('./reference-pages');
const { drawReferenceOverlay } = require('./reference-overlays');
const { drawReferenceMoment } = require('./reference-moments');
const { drawSelfPlayer } = require('./table-player');
const { drawControl } = require('./control-ui');
const { challenges, challenge, socialOverlay, socialBubbles } = require('./challenge-screens');
const { dealFrame, drawFrame, handLayout, handCardPose, clampHandPose, seatPoint, playGap, flyingCard,
  HAND_X, HAND_WIDTH, PLAY_FLIGHT, cardReveal } = require('./table-motion');
const { activeEffects, drawCenterEffect, drawPenaltyStamp, drawReport, drawMissedReport, drawEat, drawSuitAnnouncement } = require('./table-effects');

const WIDTH = 390;
const format = value => value > 0 ? '+' + value : value < 0 ? '−' + Math.abs(value) : '0';
const endMode = options => options.exhaustion === 'shuffle' ? '洗牌继续' : '直接流局';

function title(game, text, detail) {
  const { paint: p, top } = game;
  p.icon('‹', 20, top + 4, () => game.back());
  p.heading(text, 195, top + 27);
  if (detail) p.text(detail, 195, top + 58, 12, C.muted);
}

function background(game) {
  const { paint: p, height: h, page, images } = game;
  if (page !== 'home' && partyViews.themedBackground(game)) {
    if (!['table','spectator','replay'].includes(page)) p.box(0,0,WIDTH,h,0,'rgba(5,31,26,.22)');
    return;
  }
  p.box(0, 0, WIDTH, h, 0, C.jade);
  if (page === 'home') {
    p.cover(images.hero, 0, 0, WIDTH, h - game.bottom - 272, 1);
    if (h < 740) p.box(0,0,WIDTH,game.top+192,0,p.gradient(0,game.top+192,'rgba(5,35,28,.78)','rgba(5,35,28,0)'));
  }
  else {
    if (page !== 'table') p.box(0, 0, WIDTH, h, 0, 'rgba(3,24,17,.26)');
  }
}

function home(game) {
  const { paint: p, height: h, top, bottom, images } = game;
  p.icon('?', 276, top + 4, () => game.open('rules'));
  p.icon('⚙', 326, top + 4, () => game.open('settings'));
  const logoY = top + 51;
  if (!p.sprite('homeLogo', 27, logoY, 336, 102)) p.heading('一起抹车',195,logoY + 51,51);
  p.flower(72,logoY + 119,3.5,C.gold);
  p.text('广东纸牌 · 好友同桌',195,logoY + 119,14,C.cream,{weight:500});
  p.flower(318,logoY + 119,3.5,C.gold);
  const y = h - bottom - 282;
  p.panel(9, y, 372, 282);
  p.button('创建好友房', 29, y + 19, 332, 57, () => game.open('create'));
  p.button('加入好友房', 29, y + 89, 160, 47, () => game.open('join'), 'secondary');
  p.button('人机练习', 201, y + 89, 160, 47, () => game.open('practice'), 'secondary');
  p.button('残局挑战',29,y + 149,160,42,()=>game.openChallenges(),'paper');
  p.button('每日练习',201,y + 149,160,42,()=>game.startDaily(),'paper');
  p.line(30,y + 211,360,y + 211,'#D9C397',.7);
  [['records','我的战绩',()=>game.openRecords()],['table','我的茶桌',()=>game.openPartyPage('themes')],['book','新手教学',()=>game.startTutorial()]].forEach(([icon,label,action],i)=>{
    const x=29 + i*115;
    p.glyph(icon,x + 13,y + 244,19,C.ink);
    p.text(label,x + 66,y + 244,14,C.ink,{max:72});
    p.hit(x - 3,y + 220,111,49,action);
    if(i<2) p.line(x + 109,y + 233,x + 109,y + 255,'#D4BC8C',.7);
  });
  if (game.online.session) {
    p.button('返回牌局 ›', 113, y - 50, 164, 39, () => game.online.reconnect(), 'secondary');
  } else if (game.lastParty?.match) {
    p.button('上场战报 ›',113,y - 50,164,39,()=>{game.partyRecord=game.lastParty;game.openPartyPage('matchBoard');},'secondary');
  }
}

function configure(game) {
  if (game.page !== 'practice') { partyViews.configureParty(game); return; }
  const { paint: p, height: h, top, bottom, page, connecting, busy } = game;
  const editing = page === 'roomConfig';
  const options = editing ? game.roomDraft : game.options;
  const practice = page === 'practice';
  title(game, practice ? '人机练习' : editing ? '修改房间玩法' : '创建好友房', practice ? '电脑只看自己的牌与公开信息' : editing ? '修改后，其他玩家需要重新准备' : '先选好玩法，再邀请好友进桌');
  const y = top + 84;
  p.panel(22, y, 346, practice ? 402 : 367);
  const labels = [['桌位人数', 'players', 2, 6], ['牌副数', 'decks', 1, 4]];
  labels.forEach(([label, key, min, max], i) => {
    const line = y + 27 + i * 66;
    p.text(label, 49, line + 22, 17, C.ink, { align: 'left' });
    const minimum = editing && key === 'players' ? game.room.players.length : min;
    p.button('−', 193, line, 44, 44, options[key] > Math.max(min, minimum) ? () => options[key]-- : null, 'paper');
    p.text(options[key], 250, line + 22, 20, C.ink);
    p.button('+', 265, line, 44, 44, options[key] < max ? () => options[key]++ : null, 'paper');
  });
  p.line(46, y + 155, 344, y + 155, '#BBA573');
  p.text('摸牌堆用完', 49, y + 179, 16, C.ink, { align: 'left' });
  [['shuffle', '洗牌继续'], ['draw', '直接流局']].forEach(([value, label], i) => {
    const line = y + 195 + i * 47;
    const selected = options.exhaustion === value;
    p.box(47, line, 296, 42, 11, selected ? '#EBC773' : '#F4E3BB', selected ? '#AC7232' : '#CDB887');
    p.circle(67, line + 21, 8, C.light, selected ? C.red : '#8A805E', 1.5);
    if (selected) p.circle(67, line + 21, 4, C.red);
    p.text(label, 85, line + 21, 16, C.ink, { align: 'left' });
    p.hit(47, line, 296, 44, () => { options.exhaustion = value; });
  });
  if (!practice) {
    p.text('断线 30 秒自动托管', 49, y + 324, 15, C.ink, { align: 'left' });
    p.button(options.offlineAuto ? '开启' : '关闭', 263, y + 303, 65, 42, () => { options.offlineAuto = !options.offlineAuto; }, 'paper');
    p.text('断线保留座位，重连后恢复自己操作', 49, y + 349, 11, '#5B6550', { align: 'left' });
  }
  if (practice) {
    p.text('电脑难度', 49, y + 306, 16, C.ink, { align: 'left' });
    DIFFICULTIES.forEach((level, i) => p.button(level.name, 47 + i * 101, y + 324, 94, 40,
      () => { game.difficulty = level.id; }, game.difficulty === level.id ? 'primary' : 'paper'));
    p.text(DIFFICULTIES.find(d => d.id === game.difficulty).detail, 195, y + 384, 12, '#5B6550');
  }
  const action = practice ? () => game.startPractice() : editing ? () => game.saveRoomOptions() : () => game.enterOnline('create');
  p.button(practice ? '开始练习' : editing ? '保存玩法 · 重新准备' : '创建房间', 39, Math.min(h - bottom - 68, y + (practice ? 423 : 389)), 312, 53, !connecting && !busy ? action : null);
}

function join(game) {
  const { paint: p, height: h, top, bottom, roomCode, connecting, busy } = game;
  title(game, '加入好友房', '输入好友分享的六位房间号');
  p.hit(83,top+6,224,44,()=>game.tapControlTitle(),{silent:true,controlEntry:true});
  const y = top + 79;
  p.panel(23, y, 344, 211);
  for (let i = 0; i < 6; i++) {
    const x = 39 + i * 52;
    p.box(x, y + 22, 47, 49, 9, '#FFF3D4', i === roomCode.length ? C.red : '#AE9663', 1.4);
    p.text(roomCode[i] || '·', x + 23, y + 47, 22, roomCode[i] ? C.ink : '#A2916B');
  }
  p.text('你的名称', 42, y + 102, 13, C.ink, {align:'left'});
  p.text((game.nameEditing ? game.nameDraft : game.preferences.nickname) || '默认名称', 110, y + 102, 15, C.ink, {align:'left',max:145});
  p.button('修改', 278, y + 82, 64, 40, !busy && !connecting && !game.nameEditing ? () => game.editNickname() : null, 'paper');
  p.button('加入牌桌', 40, y + 142, 151, 48, roomCode.length === 6 && !busy && !connecting && !game.nameEditing ? () => game.enterOnline('join') : null);
  p.button('观战 / 候补', 201, y + 142, 149, 48, roomCode.length === 6 && !busy && !connecting && !game.nameEditing ? () => game.enterOnline('watch') : null, 'paper');
  const keyTop = y + 227;
  const keyGap = Math.min(56, Math.max(38, (h - bottom - keyTop - 12) / 4));
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '清空', '0', '⌫'];
  keys.forEach((key, index) => p.button(key, 36 + index % 3 * 108, keyTop + Math.floor(index / 3) * keyGap,
    102, keyGap - 8, () => game.inputCode(key), index > 8 && index !== 10 ? 'secondary' : 'paper'));
}

function room(game) {
  const { paint: p, top, height: h, bottom, room: state, images, busy } = game;
  if (!state) return;
  const { options, players, self, host, code } = state;
  const editable = self === host && state.features?.includes('room-options');
  p.icon('≡', 326, top + 4, () => game.openPartyPage('party'));
  title(game, '好友房间', options.decks + '副 · ' + endMode(options) + ' · ' + (options.roundLimit ? options.roundLimit + '局' : '自由局') + ' · ' + (options.turnSeconds ? options.turnSeconds + '秒' : '不限时') + (editable ? ' ›' : ''));
  if (editable && !busy) p.hit(90, top + 43, 265, 32, () => game.editRoomOptions());
  const y = top + 79;
  const rowGap = Math.min(56, (h - bottom - y - 188) / options.players);
  p.panel(22, y, 346, 113 + options.players * rowGap);
  p.text('房间号 ' + code, 153, y + 35, 20, C.ink);
  p.button('复制', 244, y + 14, 76, 44, () => game.copyCode(), 'paper');
  for (let index = 0; index < options.players; index++) {
    const item = players[index];
    const line = y + 65 + index * rowGap;
    p.box(41, line, 308, rowGap - 7, 12, item ? '#F6E6BD' : '#E9D8AE', '#C5AF80');
    p.avatar(item ? images['avatar' + item.avatar] : null, 67, line + 24, 17, item ? item.name[1] : '＋', item ? C.gold : '#8F9570');
    p.text(item ? item.name + (index === self ? '（你）' : '') : '空位', 93, line + 24, 15, C.ink, { align: 'left', max: 170 });
    if (item) {
      const status = !item.online ? '离线' : index === host ? '房主' : item.ready ? '已准备' : '未准备';
      p.text(status, 327, line + 24, 13, item.ready ? '#286B49' : '#674A2D', { align: 'right' });
      if (self === host && index !== self && !busy) p.hit(41, line, 308, rowGap - 7, () => game.manage(index));
    }
  }
  p.text(self === host ? '点玩家管理座位 · 点这里提醒准备' : '至少两人，准备后等待房主开局', 195, y + 87 + options.players * rowGap, 12, C.ink);
  if (self === host && !busy) p.hit(42, y + 67 + options.players * rowGap, 306, 40, () => { game.send('remind'); game.toast('已提醒未准备的玩家'); });
  const actionY = Math.min(h - bottom - 69, y + 135 + options.players * rowGap);
  const mayStart = players.length >= 2 && players.every((item, i) => item.online && (i === host || item.ready));
  p.button('邀请好友', 28, actionY, 146, 51, () => game.share(), 'secondary');
  if (self === host) p.button('开始游戏', 186, actionY, 176, 51, mayStart && !busy ? () => game.send('start') : null);
  else p.button(players[self].ready ? '取消准备' : '准备', 186, actionY, 176, 51, !busy ? () => game.send('ready', { ready: !players[self].ready }) : null);
}

function tableScores(p, players, self, scores, y) {
  const width = 298 / players.length;
  p.box(22, y, 346, 40, 19, p.gradient(y,40,'#FFF2D2','#E7D0A0'), C.gold, 1.4);
  p.box(25,y + 3,340,34,16,null,'#FFF9E4',.7);
  if(players.length<=4){
    players.forEach((a,i)=>{const seat=(self+i)%players.length,x=29+i*332/players.length;
      if(i)p.line(x,y+9,x,y+31,C.gold,.7);
      p.heading(seat===self?'你':players[seat].name,x+24,y+20,16,C.ink,39);
      p.heading(format(scores[seat]),x+61,y+20,17,scores[seat]>0?C.red:C.ink,36);
    });return;
  }
  p.text('积分', 46, y + 20, 12, C.ink);
  for (let index = 0; index < players.length; index++) {
    const seat = (self + index) % players.length;
    const x = 70 + width * index;
    const score = scores[seat];
    p.line(x, y + 7, x, y + 33, '#C2A975', .7);
    p.text(seat === self ? '你' : players[seat].name, x + width / 2, y + 11, 11, C.ink, { max: width - 8 });
    const color = score < 0 ? C.jade : score > 0 ? C.red : '#726B51';
    p.text(format(score), x + width / 2, y + 27, 14, color, { max: width - 8 });
  }
}

function table(game, now) {
  const { paint: p, room: state, images, height: h, top, bottom, effects, selected, busy } = game;
  if (!state?.round) return;
  const { round, self, players } = state;
  const { turn, hand, penalty, chosenSuit, legal, event, canEat } = round;
  const myTurn = turn === self;
  const dealing = now < game.dealUntil
    ? dealFrame(game.dealStart, now, players.length, round.dealer) : null;
  const motions = [...(game.outgoingPlays || []), game.playMotion].filter(motion => motion?.ends > now);
  const motion = motions[0] || null;
  const pickups = game.drawMotions.map(motion => ({ motion, frame: drawFrame(motion, now) }));
  const pendingCards = new Set();
  for (const { motion: pickup, frame } of pickups) {
    if (pickup.seat === self) pickup.cards.slice(frame.arrived).forEach(card => pendingCards.add(card.id));
  }
  const auto = players[self].auto;
  const returnNextRound = players[self].returnNextRound;
  const interactive = myTurn && !auto && !state.paused && !round.result && !busy && !game.connecting && !dealing;
  const reported = round.reported?.[self];
  const mustReport = !round.result && !dealing && hand.length === 1 && !reported;
  const handCounts = dealing?.counts || round.handCounts.map((count, seat) =>
    Math.max(0, count - pickups.filter(p => p.motion.seat === seat).reduce((n, p) => n + p.frame.remaining, 0)));
  const deckCount = round.deckCount + (dealing
    ? round.handCounts.reduce((total, count, seat) => total + count - handCounts[seat], round.opening ? 1 : 0)
    : pickups.filter(p => !p.motion.recycled).reduce((n, p) => n + p.motion.count - p.frame.departed, 0));
  const handY = h - bottom - 235;
  const actionY = h - bottom - 101;
  const cross = players.length >= 4;
  const point = seat => seatPoint(seat, self, players.length, top, handY);
  const feedback = activeEffects(effects, now);
  const centerEffect = feedback.filter(item => ['eat', 'penalty'].includes(item.effect.type)).pop();
  const north = top + 99;
  const south = handY - 94;
  const cardH = cross ? Math.min(122, Math.max(78, south - north - 78)) : 118;
  const cardY = cross ? Math.max(north + 46, (north + south - cardH) / 2)
    : Math.max(top + 176, (top + 139 + handY - cardH - 65) / 2);
  p.icon('⚙', 326, top + 4, () => game.open('settings'));
  p.icon('≡', 20, top + 4, () => game.openPartyPage('party'));
  const practiceLevel = game.practice?.date ? '每日挑战' : game.practice && DIFFICULTIES.find(d => d.id === game.practice.difficulty)?.name;
  p.brand(113,top-5,164,49);
  const seconds = state.turnDeadline && !state.paused && !round.result ? Math.min(state.options.turnSeconds, Math.max(0, Math.ceil((state.turnDeadline - now - (game.serverOffset || 0)) / 1000))) : null;
  p.chip('第 ' + round.number + ' 局' + (seconds!==null?' · '+seconds+' 秒':practiceLevel ? ' · ' + practiceLevel : state.options.roundLimit?' · '+state.options.roundLimit+'局赛':''), 195, top + 37, 185,seconds!==null&&seconds<=5);
  if (!round.result && !dealing) {
    if (!state.code) {
      p.text('互动', 338, top + 65, 12, C.cream);
      p.hit(306, top + 47, 65, 36, () => game.openSocial());
    }
    p.text('提示', 51, top + 65, 12, C.cream);
    p.hit(21, top + 47, 65, 36, () => game.hint());
    if (state.code) {
      p.text(returnNextRound ? '下局接回' : auto ? '接管' : '托管', 338, top + 65, 12, auto ? '#FFE09C' : C.cream);
      if (!busy && !returnNextRound) p.hit(306, top + 47, 65, 36, () => game.toggleAuto());
    }
  }
  players.forEach((player, seat) => {
    if (seat === self) return;
    const { x, y } = point(seat);
    const baseRadius = players.length > 4 ? 22 : 29;
    const radius = p.avatarRadius(baseRadius);
    const active = !dealing && seat === turn;
    if (active) p.circle(x, y, radius + 3.5, penalty ? '#9B3425' : '#7F6129', penalty ? C.hot : '#FBD077', 1.2);
    const name = seat === self ? '你' : player.name;
    p.avatar(images['avatar' + player.avatar], x, y, baseRadius, name.slice(-1), active && penalty ? C.hot : C.gold);
    if (state.match?.awards?.some(a => a.id === player.id)) p.text('★', x + radius, y - radius, 15, '#FFE09C');
    const announced = !dealing && round.reported?.[seat];
    if (p.uiTheme && cross) {
      const countText=announced?'报':handCounts[seat]+'张';
      const badgeX=x>300?x-radius-7:x+radius+7;
      p.box(badgeX-14,y+2,28,19,9,C.light,C.gold,.7);
      p.text(countText,badgeX,y+11.5,12,C.ink);
      p.box(x-32,y+radius+2,64,18,9,p.gradient(y+radius,18,'#FFF2D2','#E9D09D'),C.gold,.7);
      p.heading(name,x,y+radius+11,14,C.ink,58);
      p.text(format(round.scores[seat]),x,y+radius+30,12,C.cream);
    } else p.chip(name + ' · ' + (announced ? '已报牌' : handCounts[seat] === 1 ? '待报' : handCounts[seat] + ' 张'), x, y + radius + 2, cross ? 96 : 105,
        announced || (active && Boolean(penalty)));
    if (player.auto || !player.online) p.text(player.auto ? '托管中' : '暂时离线', x, y + radius + 43, 11, '#FFA58A');
  });

  const centerCardW=Math.min(86,cardH/1.42);
  const drawX = 140-centerCardW/2;
  const topX = 248-centerCardW/2;
  if (deckCount) {
    p.card(null, drawX + 4, cardY + 6, centerCardW, cardH);
    p.card(null, drawX, cardY, centerCardW, cardH);
  } else p.card(null, drawX, cardY, centerCardW, cardH, 'empty');
  const compact = cross && cardH < 85;
  if(!p.uiTheme)p.text((compact ? '牌堆 ' : '摸牌堆 ') + deckCount, drawX + (compact ? 21 : 36), cardY + cardH + 18, 13, C.cream);
  drawCenterEffect(p, centerEffect, 195, cardY + cardH / 2);
  const offset = centerEffect?.effect.type === 'penalty'
    ? (1 - centerEffect.progress) * centerEffect.effect.shake * Math.sin(centerEffect.progress * 26) : 0;
  const shownTop = dealing ? null : motion ? motion.previousTop : round.top;
  p.card(shownTop, topX + offset, cardY, centerCardW, cardH, shownTop ? '' : 'empty');
  const label = !dealing && round.step === 0 && round.opening ? '起始牌' : compact ? '顶牌' : '桌面顶牌';
  if(!p.uiTheme)p.text(label, topX + (compact ? 49 : 35), cardY + cardH + 18, 13, C.cream);

  if (state.paused) p.chip('牌桌已暂停', 195, handY - 39, 156);
  else if (dealing) p.chip('正在发牌', 195, handY - 39, 156);
  else if (round.result) {
    const ending = event.type === 'eat' ? '吃牌获胜' : '出完手牌';
    p.chip(round.result.winner === null ? '本局流局 · 不计分' : players[round.result.winner].name + ' · ' + ending, 195, handY - 39, 190, true);
  }
  else if (pickups.length) {
    const { motion: pickup } = pickups[pickups.length - 1];
    p.chip((pickup.seat === self ? '你' : players[pickup.seat].name) + (pickup.reason === 'missed-report' ? '漏报补摸 ' : pickup.requested > 1 ? '罚摸 ' : '摸牌 ') + pickup.count + ' 张',
      195, handY - 39, 190, pickup.requested > 1);
  }
  else if (penalty) p.chip('累计罚摸 ' + penalty + ' 张', 195, handY - 39, 190, true);
  else if (chosenSuit) p.chip('当前花色 ' + symbols[chosenSuit] + ' ' + suitName(chosenSuit, game.preferences.voice), 195, handY - 39, 184);
  else if (now < game.openingUntil && round.opening && round.step === 0) {
    p.chip('翻到 ' + ranks[round.opening.rank] + ' · ' + (players[round.starter].name) + '先出', 195, handY - 39, 220);
  } else p.chip(myTurn ? '轮到你出牌' : '等待' + players[turn].name + '出牌', 195, handY - 39, 169);
  const waiting = players[turn];
  const remaining = Math.max(0, Math.ceil(((waiting.offlineSince || now) + (state.offlineGrace || 30000) - now - (game.serverOffset || 0)) / 1000));
  const picked = hand.find(c => c.id === selected);
  const message = state.paused ? '全桌暂停 · ' + Math.max(0, Math.ceil((state.paused.until - now - (game.serverOffset || 0)) / 1000)) + ' 秒后恢复'
    : dealing ? '每人 5 张，顺时针发牌'
    : returnNextRound ? '本局电脑代打 · 下一局恢复操作'
    : auto ? '正在自动托管 · 点右上方「接管」恢复操作'
    : pickups.length ? (() => { const { motion: m, frame: f } = pickups[pickups.length - 1];
      return (m.seat === self ? '你' : players[m.seat].name) + (m.reason === 'missed-report' ? '漏报补摸' : m.requested > 1 ? '罚摸' : '摸牌') + ' · ' + f.arrived + ' / ' + m.count + ' 张'; })()
    : round.result ? '本局结束，正在结算'
    : mustReport ? '剩 1 张请报牌 · 下一位结束仍未报则摸 1 张'
    : event.reportPenalties?.some(penalty => penalty.count) ? event.reportPenalties.filter(penalty => penalty.count)
      .map(penalty => (penalty.seat === self ? '你' : players[penalty.seat].name) + '漏报，已自动摸 1 张').join(' · ')
    : canEat ? '整手点数合计 ' + round.top.rank + ' · 可以吃牌'
    : !waiting.online && !waiting.auto ? waiting.name + '离线 · ' + (state.options.offlineAuto !== false ? remaining + ' 秒后自动托管' : '等待重连（本房未开自动托管）')
    : picked ? '已选 ' + suitName(picked.suit, game.preferences.voice) + ranks[picked.rank] + ' · 点出牌确认，点牌取消'
    : myTurn && penalty ? (legal.length ? '接一张 2，把罚摸传给下一位' : '接不上 2，请摸牌')
    : myTurn && !legal.length ? '没有可接的牌，摸 1 张后过回合'
    : event.type === 'draw' && event.recycled ? '已重新洗牌'
    : myTurn && !round.top ? '你先出，可以选任意一张牌'
    : reported ? '已报牌 · 剩 1 张' : '你的手牌 · ' + hand.length + ' 张';
  p.text(message, 195, actionY - 9, 10, C.cream, { max: 355 });

  const area = { x: HAND_X - 4, y: handY - 18, w: HAND_WIDTH + 8, h: 142 };
  const layout = handLayout(hand.length, game.handScroll);
  const { total, max: maxScroll, offset: scroll } = layout;
  game.scrollZone = { ...area, type: 'hand', max: maxScroll };
  game.handScroll = scroll;
  const reflow = game.handReflow;
  const settle = reflow ? 1 - (1 - Math.min(1, Math.max(0, (now - reflow.started) / 190))) ** 3 : 1;
  const positions = {}, poses = {};
  p.ctx.save();
  p.shape(area.x, area.y, area.w, area.h, 4);
  p.ctx.clip();
  hand.slice(0, dealing ? handCounts[self] : hand.length).forEach((card, index) => {
    if (pendingCards.has(card.id)) return;
    const allowed = !dealing && legal.includes(card.id);
    const isSelected = selected === card.id;
    const state = isSelected ? 'selected' : allowed ? 'legal' : myTurn && !canEat && !dealing ? 'blocked' : '';
    let pose = handCardPose(layout, index, handY, isSelected);
    const old = reflow?.poses?.[card.id];
    if (old && settle < 1) {
      for (const key of ['x','w','h','angle']) pose[key] = old[key] + (pose[key] - old[key]) * settle;
      pose.y = handY + old.y + (pose.y - handY - old.y) * settle;
    }
    if (!maxScroll) pose = clampHandPose(pose);
    const { x: cx, y: cy, w, h: ch, angle } = pose;
    const x = cx - w / 2, y = cy - ch / 2;
    positions[card.id] = x;
    poses[card.id] = { ...pose, y: cy - handY };
    if (index >= layout.start && index < layout.end && x + w >= area.x && x < area.x + area.w) {
      p.ctx.save();p.ctx.translate(cx,cy);p.ctx.rotate(angle);
      p.card(card,-w/2,-ch/2,w,ch,state);p.ctx.restore();
      // Even a blocked card covers the legal card underneath it.
      p.hit(Math.max(area.x, x), y, Math.min(area.x + area.w, x + w) - Math.max(area.x, x), ch,
        allowed && interactive ? () => game.select(card.id) : () => {});
    }
  });
  p.ctx.restore();
  game.handPositions = positions;
  game.handPoses = poses;
  if (maxScroll) {
    const length = Math.max(24, HAND_WIDTH * HAND_WIDTH / total);
    p.box(HAND_X, handY + 114, HAND_WIDTH, 2, 1, 'rgba(198,161,91,.22)');
    p.box(HAND_X + (HAND_WIDTH - length) * scroll / maxScroll, handY + 114, length, 2, 1, C.gold);
    p.text((layout.start + 1) + '–' + layout.end + ' / ' + hand.length + ' 张 · 左右滑动', 195, handY, 10, C.cream);
    for (const direction of [-1, 1]) {
      const x = direction < 0 ? HAND_X : HAND_X + HAND_WIDTH - 34;
      const enabled = direction < 0 ? scroll > .5 : scroll < maxScroll - .5;
      p.box(x, handY - 39, 34, 31, 12, C.pine, enabled ? C.gold : C.grey, 1);
      p.text(direction < 0 ? '‹' : '›', x + 17, handY - 24, 20, enabled ? C.light : C.grey);
      if (enabled) p.hit(x, handY - 39, 34, 31, () => game.scrollHand(direction));
    }
  }
  const canDraw = interactive && !legal.length && !canEat;
  drawSelfPlayer(game, actionY, handCounts[self], Boolean(dealing));
  if(p.uiTheme) {
    p.button(canEat&&!dealing?'吃牌':penalty?'摸 '+penalty+' 张':'摸 1 张',91,actionY,87,48,canEat&&!dealing?(!state.paused&&!auto&&!round.result&&!busy&&!game.connecting&&!mustReport?()=>game.eat():null):canDraw?()=>game.draw():null,'paper');
    p.button('出牌',185,actionY,108,48,interactive&&legal.includes(selected)?()=>game.playSelected():null);
    p.button('报',300,actionY,70,48,mustReport&&!state.paused&&!auto&&!busy&&!game.connecting?()=>game.report():null,'paper');
  } else {
  if (canEat && !dealing) p.button('吃牌', 91, actionY, 100, 48, !state.paused && !auto && !round.result && !busy && !game.connecting && !mustReport ? () => game.eat() : null);
  else p.button(penalty ? '摸 ' + penalty + ' 张' : '摸 1 张', 91, actionY, 100, 48, canDraw ? () => game.draw() : null, canDraw ? 'primary' : 'secondary');
  if (mustReport) p.button('报牌', 202, actionY, 168, 48, !state.paused && !auto && !busy && !game.connecting ? () => game.report() : null);
  else p.button('出牌', 202, actionY, 168, 48, interactive && legal.includes(selected) ? () => game.playSelected() : null);
  }
  tableScores(p, players, self, round.scores, h - bottom - 46);

  if (dealing) {
    const source = { x: drawX + centerCardW / 2, y: cardY + cardH / 2, w: centerCardW, h: cardH };
    for (const { seat, index, progress } of dealing.flights) {
      const here = seat === self;
      const destination = here
        ? clampHandPose(handCardPose(layout, index, handY))
        : { ...point(seat), w: 29, h: 42 };
      const reveal=cardReveal(progress,here);
      flyingCard(p, reveal.face?hand[index]:null, source, destination, progress, 34,
        (seat % 2 ? 1 : -1) * .16, reveal.width, 'deal');
    }
  }
  for (const motion of motions) {
    const fromHand = motion.seat === self;
    const previousLayout = fromHand && handLayout(motion.hand.length, motion.handScroll);
    const gap = playGap(motion.cards.length);
    motion.cards.forEach((card, index) => {
      const progress = (now - motion.started - index * gap) / PLAY_FLIGHT;
      if (progress < 0 || progress > 1) return;
      const position = fromHand ? motion.hand.findIndex(item => item.id === card.id) : 0;
      const oldPose = fromHand && motion.handPoses?.[card.id];
      const source = fromHand
        ? clampHandPose(oldPose ? { ...oldPose, y: handY + oldPose.y }
          : handCardPose(previousLayout, position, handY, motion.selected === card.id))
        : { ...point(motion.seat), w: 33, h: 47 };
      flyingCard(p, card, source, { x: topX + centerCardW / 2, y: cardY + cardH / 2, w: centerCardW, h: cardH },
        progress, 28, fromHand ? -.15 : .17);
    });
  }
  for (const { motion: pickup, frame } of pickups) {
    const here = pickup.seat === self;
    const tier = Math.min(4, Math.ceil(pickup.requested / 2));
    const color = pickup.requested > 1 ? ['#E6CF9A', '#FFD078', '#FFE5A1', '#FFC76B', '#FFD37D'][tier] : '#F4D293';
    const destination = here ? { x: 195, y: handY + 61 } : point(pickup.seat);
    if (frame.pulse > 0) {
      p.ctx.save();
      p.ctx.globalAlpha = frame.pulse * .6;
      if (here) p.box(HAND_X - 3, handY - 2, HAND_WIDTH + 6, 120, 13, null, color, 1 + tier * .35);
      else p.circle(destination.x, destination.y, 26 + (1 - frame.pulse) * 13, null, color, 1.5);
      p.ctx.restore();
    }
    for (const { index, progress } of frame.flights) {
      const card = here ? pickup.cards[index] : null;
      const slot = here ? hand.findIndex(item => item.id === card.id) : -1;
      // A newer authoritative move can remove a drawn card before its visual arrives.
      if (here && slot < 0) continue;
      const target = here ? clampHandPose(handCardPose(layout, slot, handY))
        : { ...destination, w: 29, h: 42 };
      const source = { x: drawX + centerCardW / 2, y: cardY + cardH / 2, w: centerCardW, h: cardH };
      const reveal = cardReveal(progress,here);
      flyingCard(p, reveal.face ? card : null, source, target, progress,
        26 + tier * 4, (pickup.seat % 2 ? 1 : -1) * (.08 + tier * .025), reveal.width, 'draw');
    }
  }
  drawPenaltyStamp(p, centerEffect, 195, cardY + cardH / 2);
  if (centerEffect?.effect.type === 'eat') {
    drawEat(p,195,cardY+cardH/2,centerEffect.progress);
  }
  for (const { effect, progress } of feedback) {
    if(effect.type==='suit')drawSuitAnnouncement(p,{effect,progress},195,cardY-25);
    if (!['report', 'missed-report'].includes(effect.type)) continue;
    const { x, y } = effect.seat === self ? { x: 70, y: handY - 50 } : point(effect.seat);
    if (effect.type === 'missed-report') drawMissedReport(p, 195, cardY-25, progress);
    else drawReport(p, x, y, progress);
  }
}

function scores(game) {
  const { paint: p, room: state, height: h, top, bottom, images, page, busy } = game;
  if (!state?.round) return;
  const { round, players, self, host, code } = state;
  const result = page === 'result' ? round.result : null;
  const isDraw = result?.winner === null;
  const y = top + 79;
  title(game, result ? isDraw ? '本局流局' : '本局结算' : '累计积分', code ? '第 ' + round.number + ' 局 · 整场排名 / 战报 ›' : '第 ' + round.number + ' 局');
  if (code) p.hit(85, top + 43, 230, 30, () => game.openPartyPage('matchBoard'));
  const rowY = y + 105;
  const rowGap = Math.min(53, (h - bottom - rowY - 115) / players.length);
  p.panel(22, y, 346, 148 + players.length * rowGap);
  const lead = result
    ? isDraw ? '本局不计分' : '✦  ' + players[result.winner].name + (round.event.type === 'eat' ? ' 吃牌获胜' : ' 出完手牌') + '  ✦'
    : '好友牌桌 · 多局累计';
  p.text(lead, 195, y + 39, 20, C.ink);
  p.text('玩家', 76, y + 79, 12, C.ink);
  if (result) p.text('本局', 254, y + 79, 12, C.ink);
  p.text('累计分', 322, y + 79, 12, C.ink);
  const indices = players.map((_, index) => index);
  if (!result) indices.sort((a, b) => round.scores[b] - round.scores[a]);
  indices.forEach((seat, index) => {
    const player = players[seat];
    const line = rowY + index * rowGap;
    p.line(42, line - 3, 348, line - 3, '#C9B58B');
    p.avatar(images['avatar' + player.avatar], 64, line + 20, 16, player.name[1]);
    p.text(player.name + (seat === self ? '（你）' : ''), 89, line + 20, 15, C.ink, { align: 'left' });
    const stats = round.stats?.[seat];
    if (stats) p.text(stats.wins + '胜/' + stats.played + '局 · 最长' + stats.bestStreak + '连胜', 89, line + 37, 10, '#6B694D', { align: 'left' });
    if (result && code) p.text(player.nextReady ? '已准备' : player.returnNextRound && player.online ? '等下局准备' : player.auto && seat !== self ? '托管就绪' : !player.online ? '等待重连' : '待准备',
      340, line + 37, 10, player.nextReady ? '#236446' : '#6B694D', { align: 'right' });
    if (result?.details) p.hit(42, line, 306, rowGap, () => game.scoreDetail(seat));
    if (result) p.text(format(result.deltas[seat]), 272, line + 20, 15, result.deltas[seat] < 0 ? C.red : '#236446', { align: 'right', max: 85 });
    p.text(format(round.scores[seat]), 340, line + 20, 15, C.ink, { align: 'right', max: 66 });
  });
  if (result) {
    p.text(game.practice?.date ? '每日练习 · ' + game.practice.date : '下一局 · ' + players[result.nextStarter].name + '先出', 195, rowY + players.length * rowGap + 14, 15, C.ink);
    p.text('点玩家查看余牌与算分明细', 195, rowY + players.length * rowGap + 35, 11, '#6B694D');
  }
  else p.text('分数按本房间累计', 195, rowY + players.length * rowGap + 14, 13, C.ink);
  const actionY = Math.min(h - bottom - 68, rowY + players.length * rowGap + 70);
  if (!result) p.button('返回牌桌', 43, actionY, 304, 49, () => game.back(), 'secondary');
  else {
    const allowed = !busy && (!code || !players[self].nextReady);
    const readyCount = players.filter((p, index) => p.nextReady || index !== self && p.auto && !(p.returnNextRound && p.online)).length;
    const label = !code ? game.practice?.date ? '重练今日牌局' : '再来一局' : players[self].nextReady ? '已准备 · ' + readyCount + '/' + players.length + '人' : (state.match?.finished ? '再开一场 · ' : '准备下一局 · ') + readyCount + '/' + players.length + '人';
    if (round.history?.length) {
      p.button('本局回顾', 28, actionY, 126, 49, () => game.openReplay(), 'secondary');
      p.button(label, 165, actionY, 197, 49, allowed ? () => game.next() : null);
    } else p.button(label, 43, actionY, 304, 49, allowed ? () => game.next() : null);
  }
}

function scoreDetail(game) {
  const { paint: p, top, height: h, bottom } = game;
  const state = game.detailRecord ? { round: game.detailRecord, players: game.detailRecord.players } : game.room;
  const { round, players } = state;
  const seat = game.detailSeat, result = round.result, detail = result?.details?.[seat];
  if (!detail) { game.back(); return; }
  title(game, players[seat].name + ' · 算分明细', '第 ' + round.number + ' 局 · 本局 ' + format(result.deltas[seat]) + ' 分');
  const y = top + 80, height = h - bottom - y - 82;
  p.panel(22, y, 346, height);
  const body = { x: 35, y: y + 14, w: 320, h: height - 28 };
  p.ctx.save(); p.shape(body.x, body.y, body.w, body.h, 8); p.ctx.clip();
  let line = body.y + 20 - game.rulesScroll;
  p.text('本局剩余手牌 · ' + detail.cards.length + ' 张', 48, line, 17, C.ink, { align: 'left' });
  line += 24;
  detail.cards.forEach((card, index) => p.card(card, 48 + index % 5 * 59, line + Math.floor(index / 5) * 84, 53, 75));
  line += Math.ceil(detail.cards.length / 5) * 84 + 16;
  if (result.winner === seat) {
    line = p.wrap('你已出完手牌，获得其他玩家全部扣分之和。', 48, line, 290, 15, C.ink, 24);
    const losses = result.deltas.filter((_, i) => i !== seat).map(n => Math.abs(n));
    line = p.wrap(losses.join(' + ') + ' = ' + result.deltas[seat] + ' 分', 48, line + 20, 290, 20, '#236446', 28);
  } else {
    line = p.wrap(detail.values.length ? detail.values.join(' + ') + ' = ' + detail.base : '无剩余手牌', 48, line, 290, 18, C.ink, 26);
    line = p.wrap('8 每张计 20 分，其余按点数计分。', 48, line + 20, 290, 13, '#5B6550', 22);
    line = p.wrap(detail.doubles + ' 张 2 → 乘 ' + detail.multiplier + ' 倍', 48, line + 18, 290, 17, C.ink, 26);
    line = p.wrap(detail.base + ' × ' + detail.multiplier + ' = ' + detail.points + ' 分', 48, line + 18, 290, 23, C.red, 29);
    if (result.winner === null) line = p.wrap('本局流局：以上仅为余牌分值，实际不加不扣分。', 48, line + 18, 290, 15, C.ink, 24);
  }
  line += 28;
  p.ctx.restore();
  game.scrollZone = { ...body, type: 'rules', max: Math.max(0, line + game.rulesScroll - body.y - body.h) };
  p.button('上一位', 28, h - bottom - 61, 102, 46, () => { game.detailSeat = (seat + players.length - 1) % players.length; game.rulesScroll = 0; }, 'secondary');
  p.button('返回结算', 140, h - bottom - 61, 110, 46, () => game.back());
  p.button('下一位', 260, h - bottom - 61, 102, 46, () => { game.detailSeat = (seat + 1) % players.length; game.rulesScroll = 0; }, 'secondary');
}

function tutorial(game) {
  const { paint: p, top, height: h, bottom, room: state, tutorial: task } = game;
  const { round } = state;
  const y = top + 82, height = h - bottom - y - 83;
  title(game, '新手教学', (task.index + 1) + ' / ' + lessons.length + ' · ' + task.lesson.title);
  p.panel(22, y, 346, height);
  p.wrap(task.complete ? task.lesson.done : task.lesson.instruction, 45, y + 30, 300, 16, C.ink, 25);
  const topY = y + Math.max(105, height * .27);
  p.card(round.top, 157, topY, 76, 107);
  p.text(round.chosenSuit ? '已变为' + suitName(round.chosenSuit, game.preferences.voice) : round.penalty ? '当前罚摸 ' + round.penalty + ' 张' : task.complete ? '完成！' : '桌面顶牌', 195, topY + 126, 13, C.ink);
  const handY = y + Math.max(253, height * .60);
  p.text(task.complete ? '剩余手牌' : '你的手牌 · 点选后确认', 195, handY - 23, 12, '#5B6550');
  const first = (390 - round.hand.length * 74 + 8) / 2;
  round.hand.forEach((card, index) => {
    const x = first + index * 74, selected = game.selected === card.id;
    p.card(card, x, handY - (selected ? 7 : 0), 66, 91, selected ? 'selected' : round.legal.includes(card.id) ? 'legal' : '');
    if (!task.complete) p.hit(x, handY - 7, 66, 100, () => game.select(card.id));
  });
  const actionY = y + height - 58;
  if (!task.complete) {
    const report = round.hand.length === 1 && !round.reported[0];
    p.button(round.canEat ? '吃牌' : '摸 ' + (round.penalty || 1) + ' 张', 43, actionY, 139, 44,
      round.canEat && !report ? () => game.eat() : !round.canEat && !round.legal.length && round.turn === 0 ? () => game.draw() : null, 'paper');
    p.button(report ? '报牌' : '出牌', 194, actionY, 153, 44,
      report ? () => game.report() : game.selected ? () => game.playSelected() : null);
  } else p.text('✓ 已掌握这一课', 195, actionY + 23, 20, '#236446');
  p.button('重练本课', 28, h - bottom - 61, 136, 46, () => game.startTutorial(task.index), 'secondary');
  p.button(task.index === lessons.length - 1 ? '去人机练习' : '下一课', 178, h - bottom - 61, 184, 46, task.complete ? () => game.nextLesson() : null);
}

function rules(game) {
  const { paint: p, top, height: h, bottom, rulesScroll } = game;
  title(game, '玩法规则', '同花色或同点数 · 最先出完获胜');
  const y = top + 78, height = h - bottom - y - 22;
  p.panel(22, y, 346, height);
  const body = { x: 34, y: y + 14, w: 322, h: height - 28 };
  p.ctx.save();
  p.shape(body.x, body.y, body.w, body.h, 12);
  p.ctx.clip();
  let line = body.y + 19 - rulesScroll;
  copy.forEach(([label, text], index) => {
    p.text(String(index + 1).padStart(2, '0') + '  ' + label, 48, line, 16, C.ink, { align: 'left' });
    line = p.wrap(text, 48, line + 28, 290, 14, '#31483A', 21) + 17;
    p.line(48, line - 12, 342, line - 12, '#CDB98C');
  });
  p.ctx.restore();
  const max = Math.max(0, line + rulesScroll - body.y - body.h);
  game.scrollZone = { ...body, type: 'rules', max };
}

function settings(game) {
  const { paint: p, top, height: h, bottom, preferences } = game;
  title(game, '设置', '版本 ' + (game.platform.appVersion || VERSION) + ' · 声音与动态效果');
  if (game.platform.appInfo) p.button('关于', 306, top + 4, 66, 36, () => game.platform.appInfo(), 'secondary');
  const y = top + 84;
  p.panel(23, y, 344, 354);
  [['music', '背景音乐'], ['sound', '音效'], ['vibration', '震动'], ['reducedMotion', '减少动态效果'], ['reactions', '接收表情与短句']].forEach(([key, label], index) => {
    const row = y + 9 + index * 43;
    p.text(label, 54, row + 22, 17, C.ink, { align: 'left' });
    const active = preferences[key];
    p.toggle(active, 266, row + 7, () => game.toggle(key));
    p.hit(46, row, 300, 44, () => game.toggle(key));
    p.line(50, row + 43, 340, row + 43, '#CAB58D');
  });
  p.text('语音语言 · 点击切换并试听', 195, y + 239, 13, C.ink);
  p.button('香港粤语', 49, y + 257, 139, 36, () => game.setVoice('yue'), preferences.voice === 'yue' ? 'primary' : 'paper');
  p.button('普通话', 201, y + 257, 139, 36, () => game.setVoice('mandarin'), preferences.voice !== 'yue' ? 'primary' : 'paper');
  p.text('我的茶桌 / 大字牌 / 环境声 ›', 195, y + 315, 14, C.ink);
  p.hit(45, y + 298, 300, 30, () => game.openPartyPage('themes'));
  p.text('音乐 CC BY 4.0 · 点此复制署名', 195, y + 340, 10, C.ink);
  p.hit(45, y + 329, 300, 23, () => game.copyMusicCredits());
  const actionY = Math.min(h - bottom - 116, y + 373);
  p.button(game.room ? '返回牌桌' : '返回', 42, actionY, 306, 48, () => game.back(), 'secondary');
  if (game.room) p.button('退出房间', 42, actionY + 59, 306, 48, () => { game.overlay = 'leave'; }, 'danger');
}

function overlays(game) {
  const { paint: p, height: h, bottom, overlay, connecting, room, busy } = game;
  const vote = room?.vote;
  const mustVote = vote && vote.eligible.includes(vote.mine) && !vote.yes.includes(vote.mine) && !vote.no.includes(vote.mine);
  if (!overlay && !connecting && !mustVote) return;
  p.hits = [];
  p.box(0, 0, WIDTH, h, 0, 'rgba(1,14,10,.69)');
  if (mustVote && !overlay && !connecting) {
    const y = h / 2 - 128;
    p.panel(24, y, 342, 256);
    p.text(vote.kind === 'pause' ? '同意暂停两分钟？' : '同意本场散桌？', 195, y + 40, 22, C.ink);
    p.text(vote.kind === 'pause' ? '暂停期间不能出牌，倒计时停止' : '未完成本局不计分，已完成积分保留', 195, y + 83, 13, C.ink);
    p.text(vote.yes.length + '/' + vote.eligible.length + ' 已同意 · ' + Math.max(0, Math.ceil((vote.expires - Date.now() - (game.serverOffset || 0)) / 1000)) + '秒', 195, y + 119, 14, C.ink);
    p.button('不同意', 43, y + 165, 144, 47, !busy ? () => game.send('vote', { voteId: vote.id, agree: false }) : null, 'paper');
    p.button('同意', 203, y + 165, 144, 47, !busy ? () => game.send('vote', { voteId: vote.id, agree: true }) : null); return;
  }
  if (overlay === 'social') { socialOverlay(game); return; }
  if (overlay === 'suit') {
    const y = h - bottom - 236;
    p.panel(15, y, 360, 224);
    p.text('选择花色', 195, y + 31, 22, C.ink);
    p.icon('×', 318, y + 11, () => { game.overlay = null; });
    SUITS.forEach((suit, index) => {
      const x = 31 + index * 84;
      const selected = suit === game.suit;
      p.box(x, y + 64, 75, 77, 12, selected ? '#F3CC75' : '#FFF1CF', selected ? C.red : '#9C936C', selected ? 2 : 1);
      p.suit(suit, x + 38, y + 91, 29, suit === 'heart' || suit === 'diamond' ? C.red : C.ink);
      p.text(suitName(suit, game.preferences.voice), x + 38, y + 122, 13, C.ink);
      p.hit(x, y + 64, 75, 77, () => { game.suit = suit; });
    });
    p.button('确认出 8', 47, y + 156, 296, 49, game.suit && !busy ? () => game.confirmSuit() : null);
    return;
  }
  if (overlay === 'manage' || overlay === 'kick') {
    const target = room.players[game.manageSeat];
    const y = h / 2 - 135;
    p.panel(24, y, 342, 270);
    p.text(target ? '管理座位 · ' + target.name : '座位已变更', 195, y + 37, 21, C.ink);
    if (overlay === 'kick') {
      p.text('确认将这位玩家移出等待房间？', 195, y + 84, 15, C.ink);
      p.button('确认移出', 47, y + 121, 296, 48, !busy ? () => game.confirmManage('kick') : null, 'danger');
    } else {
      p.button('转让房主给对方', 47, y + 76, 296, 46, target?.online && !busy ? () => game.confirmManage('transfer') : null, 'paper');
      p.button('移出房间', 47, y + 132, 296, 46, target && !busy ? () => { game.overlay = 'kick'; } : null, 'danger');
    }
    p.button('取消', 47, y + 199, 296, 46, () => { game.overlay = null; }, 'secondary');
    return;
  }
  const y = h / 2 - 103;
  p.panel(24, y, 342, 206);
  if (overlay === 'switchRoom') {
    p.text('离开原桌，进入新桌？', 195, y + 40, 22, C.ink);
    p.text('原桌由电脑代打，放弃的座位不能找回', 195, y + 83, 13, C.ink);
    p.button('保留原桌', 43, y + 127, 144, 48, () => { game.overlay = null; game.switchIntent = null; }, 'paper');
    p.button('确认换桌', 203, y + 127, 144, 48, !busy ? () => game.confirmSwitch() : null, 'danger');
  } else if (overlay === 'confirmVote') {
    p.text(game.pendingVote === 'pause' ? '发起暂停投票？' : '发起散桌投票？', 195, y + 40, 23, C.ink);
    p.text('需当前在线在座玩家一致同意', 195, y + 83, 14, C.ink);
    p.button('取消', 43, y + 127, 144, 48, () => { game.overlay = null; }, 'paper');
    p.button('发起', 203, y + 127, 144, 48, !busy ? () => { game.send('vote', { kind: game.pendingVote }); game.overlay = null; } : null);
  } else if (overlay === 'clearRecords') {
    p.text('清空本机战绩？', 195, y + 43, 23, C.ink);
    p.text('将清除这台设备保存的对局记录', 195, y + 83, 14, C.ink);
    p.button('取消', 47, y + 127, 137, 48, () => { game.overlay = null; }, 'paper');
    p.button('确认清空', 202, y + 127, 141, 48, () => game.clearRecords(), 'danger');
  } else if (overlay === 'leave') {
    p.text('退出房间？', 195, y + 43, 24, C.ink);
    p.text(room?.code && room.round && !room.watching && !room.ended ? '保留座位，电脑代打；回来后下一局接回' : '你将返回大厅', 195, y + 83, 13, C.ink);
    p.button('取消', 47, y + 127, 137, 48, () => { game.overlay = null; }, 'paper');
    p.button('退出', 202, y + 127, 141, 48, () => game.leave(), 'danger');
  } else {
    p.text('连接好友房', 195, y + 40, 23, C.ink);
    p.text(connecting, 195, y + 81, 15, C.ink, { max: 295 });
    p.button('返回大厅', 47, y + 127, 137, 48, () => game.cancelConnection(), 'paper');
    p.button('重新连接', 199, y + 127, 144, 48, game.online.session ? () => game.online.reconnect() : null);
  }
}

const pages = { home, create: configure, practice: configure, roomConfig: configure, join, room, table, result: scores, scores, scoreDetail, tutorial, rules, settings, records, replay, challenges, challenge,
  party: partyViews.party, spectator: partyViews.spectator, matchBoard: partyViews.matchBoard, warReport: partyViews.warReport, themes: partyViews.themes };
function drawScene(game, now) {
  background(game);
  if (!drawControl(game) && !drawReferenceMoment(game,now) && !drawFidelity(game) && !drawReference(game)) (pages[game.page]||referenceViews[game.page]||home)(game, now);
  socialBubbles(game, now);
  if(!drawReferenceOverlay(game))overlays(game);
  if (game.notice) game.paint.chip(game.notice, 195, game.top + 56, 326);
}

module.exports = { drawScene, WIDTH };
