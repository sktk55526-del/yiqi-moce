'use strict';

const { HAND_SIZE } = require('../shared/rules');

const DEAL_GAP = 54;
const DEAL_FLIGHT = 360;
const PLAY_FLIGHT = 360;
const HAND_X = 19;
const HAND_WIDTH = 352;
const CARD_WIDTH = 84;
const DRAW_FLIGHT = 360;
const DRAW_SETTLE = 120;

function drawGap(count) {
  return Math.min(Math.max(42, 86 - count * 5), 520 / Math.max(1, count - 1));
}

function drawDuration(count) {
  return count ? DRAW_FLIGHT + (count - 1) * drawGap(count) + DRAW_SETTLE : 0;
}

function drawFrame(motion, now) {
  const age = now - motion.started;
  const flights = [];
  let arrived = 0, departed = 0;
  for (let index = 0; index < motion.count; index++) {
    const progress = (age - index * drawGap(motion.count)) / DRAW_FLIGHT;
    if (progress >= 0) departed++;
    if (progress >= 1) arrived++;
    else if (progress >= 0) flights.push({ index, progress });
  }
  const landingAge = arrived ? age - (arrived - 1) * drawGap(motion.count) - DRAW_FLIGHT : Infinity;
  return { arrived, departed, flights, remaining: motion.count - arrived,
    pulse: Math.max(0, 1 - landingAge / DRAW_SETTLE) };
}

function dealDuration(players) {
  return (players * HAND_SIZE - 1) * DEAL_GAP + DEAL_FLIGHT;
}

function dealFrame(start, now, players, dealer) {
  const age = now - start;
  const counts = Array(players).fill(0);
  const flights = [];
  for (let index = 0; index < players * HAND_SIZE; index++) {
    const seat = (dealer + 1 + index % players) % players;
    const progress = (age - index * DEAL_GAP) / DEAL_FLIGHT;
    if (progress >= 1) counts[seat]++;
    else if (progress >= 0) flights.push({ seat, index: Math.floor(index / players), progress });
    else break;
  }
  return { counts, flights };
}

function handLayout(count, scroll = 0) {
  count = Math.max(0, Math.floor(Number(count) || 0));
  const visible = Math.min(12, Math.max(1, count));
  // Reserve room for the rotated edges of a small fan. Larger hands form a
  // straight row; twelve cards fit without hiding the two digits of a 10.
  const inset = count <= 6 ? 6 : 0;
  const width = HAND_WIDTH - inset * 2;
  const w = Math.min(CARD_WIDTH, width / (1 + .43 * (visible - 1)));
  const h = w * 110 / CARD_WIDTH;
  const gap = visible > 1 ? Math.min(90, (width - w) / (visible - 1)) : 0;
  const total = count ? w + gap * (count - 1) : 0;
  const max = count > visible ? total - width : 0;
  const offset = Math.max(0, Math.min(Number.isFinite(scroll) ? scroll : 0, max));
  const start = max ? Math.floor(offset / gap + 1e-7) : 0;
  return { count, w, h, visible, gap, total, max, offset,
    first: HAND_X + inset + Math.max(0, (width - total) / 2) - offset,
    pageStep: gap * visible, start, end: Math.min(count, start + visible) };
}

// One geometry source for drawing, hit areas, dealing and penalty-card flights.
function handCardPose(layout, index, handY, selected = false) {
  const angle = layout.count <= 6 ? (index - (layout.count - 1) / 2) * .025 : 0;
  return { x: layout.first + layout.gap * index + layout.w / 2,
    y: handY + 61 + Math.abs(angle) * 16 - (selected ? 13 : 0),
    w: layout.w, h: layout.h, angle };
}

function clampHandPose(pose) {
  const half = (Math.abs(Math.cos(pose.angle)) * pose.w + Math.abs(Math.sin(pose.angle)) * pose.h) / 2;
  return { ...pose, x: Math.max(HAND_X + half, Math.min(HAND_X + HAND_WIDTH - half, pose.x)) };
}

function seatPoint(seat, self, players, top, handY) {
  const offset = (seat - self + players) % players;
  if (players < 4) return { x: offset * 390 / players, y: top + 93 };
  const north = top + 99;
  const south = handY - 94;
  const middle = (north + south) / 2;
  if (players === 6) {
    const spread = (south - north) * .23;
    return [{ x: 195, y: south }, { x: 52, y: middle + spread }, { x: 52, y: middle - spread },
      { x: 195, y: north }, { x: 338, y: middle - spread }, { x: 338, y: middle + spread }][offset];
  }
  if (players === 5) return [{ x: 195, y: south }, { x: 52, y: middle + (south - north) * .17 },
    { x: 100, y: north }, { x: 290, y: north }, { x: 338, y: middle + (south - north) * .17 }][offset];
  return [
    { x: 195, y: south }, { x: 52, y: middle },
    { x: 195, y: north }, { x: 338, y: middle },
  ][offset];
}

function eatImpact(paint, x, y, progress) {
  const g = paint.ctx;
  const ease = 1 - (1 - progress) ** 3;
  g.save();
  g.globalAlpha = (1 - progress) ** 1.4;
  paint.circle(x, y, 34 + 50 * ease, null, '#FFD775', 3);
  paint.circle(x, y, 23 + 48 * ease, null, '#FFF0B1', 1.5);
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4 + .16;
    const dx = Math.cos(angle), dy = Math.sin(angle);
    const ray = 35 + (43 + (i % 2) * 13) * ease;
    const end = ray + 6 + (i % 2) * 4;
    paint.line(x + dx * ray, y + dy * ray, x + dx * end, y + dy * end,
      i % 2 ? '#FFE4A2' : '#EBB24D', 2.6);
  }
  g.restore();
}

function playGap(count) {
  return Math.min(42, 105 / Math.max(1, count - 1));
}

function playDuration(count) {
  return PLAY_FLIGHT + (count - 1) * playGap(count);
}

const clamp = n => Math.max(0, Math.min(1, n));
// One continuous flight, with zero velocity and acceleration at either end.
// Feedback never pauses the card or changes the authoritative round.
function motionPose(from, to, progress, lift = 28, angle = .15) {
  const t = clamp(progress);
  const e = t * t * t * (t * (t * 6 - 15) + 10);
  const arc = t === 0 || t === 1 ? 0 : Math.sin(Math.PI * e) ** 2;
  const scale = 1 + .035 * arc;
  return { x: from.x + (to.x - from.x) * e,
    y: from.y + (to.y - from.y) * e - lift * arc,
    w: (from.w + (to.w - from.w) * e) * scale,
    h: (from.h + (to.h - from.h) * e) * scale,
    angle: (from.angle||0)*(1-e)+(to.angle||0)*e+angle*arc,
    travel: t, landing: clamp((t - .76) / .24) };
}

function landingGlow(p, x, y, width, progress, strength = 1) {
  if (progress < 0 || progress >= 1) return;
  const g = p.ctx, alpha = Math.sin(Math.PI * progress) * .85;
  g.save(); g.globalAlpha *= alpha; g.translate(x, y);
  g.shadowColor = '#FFBB39'; g.shadowBlur = 9 * strength;
  for (let i = 0; i < 2; i++) {
    g.save(); g.scale(1, .24); p.circle(0, 0, width * (.56 + progress * .15 + i * .08), null, i ? '#F9BD53' : '#FFF3BC', i ? 1.1 : 2); g.restore();
  }
  for (let i = 0; i < 3; i++) {
    const a = -.95 + i * .35, sx = Math.cos(a) * width * .47, sy = Math.sin(a) * width * .5;
    p.line(sx, sy - width * .56, sx + Math.cos(a) * (8 + strength * 2), sy - width * .56 + Math.sin(a) * 12, '#FFE8A3', 2);
  }
  g.restore();
}

function cardReveal(progress, faceUp) {
  const reveal=faceUp?clamp((progress-.52)/.28):0;
  return {face:reveal>.5,width:faceUp?Math.max(.04,Math.abs(Math.cos(reveal*Math.PI))):1};
}

function flyingCard(paint, card, from, to, progress, lift, angle, flip = 1, kind = 'play') {
  if (progress < 0 || progress > 1) return;
  const t = clamp(progress), pose = motionPose(from, to, t, lift, angle), g = paint.ctx;
  g.save();
  // Three narrow, curved golden ribbons follow the actual card path.
  if (pose.travel > 0 && pose.travel < 1) {
    g.lineCap = 'round';
    const trail=paint.flightTrail||(paint.flightTrail=new Float64Array(26));
    for(let j=0;j<=12;j++){
      const past=motionPose(from,to,Math.max(0,t-.23+.23*j/12),lift,angle);
      trail[j*2]=past.x;trail[j*2+1]=past.y;
    }
    for (let rail = -1; rail <= 1; rail++) {
      g.beginPath();
      for (let j = 0; j <= 12; j++) {
        const px = trail[j*2] + rail * 7, py = trail[j*2+1] + rail * 5;
        if (!j) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.strokeStyle = rail ? 'rgba(255,207,101,.48)' : '#FFEAB1';
      g.lineWidth = rail ? 1.4 : 2.3; g.stroke();
    }
    g.shadowBlur = 0;
    for (let i = 2; i >= 1; i--) {
      const past = motionPose(from, to, Math.max(0, t - i * .065), lift, angle);
      g.save();g.globalAlpha *= .11 / i * Math.sin(Math.PI * t);g.translate(past.x,past.y);g.rotate(past.angle);
      paint.box(-past.w/2,-past.h/2,past.w,past.h,6,'#FFE5A2');g.restore();
    }
  }
  if (pose.landing > 0) landingGlow(paint, to.x, to.y + to.h * .4, to.w, pose.landing, kind === 'draw' ? 1.3 : 1);
  g.translate(pose.x, pose.y);g.rotate(pose.angle);g.scale(flip, 1);
  // Glow only the silhouette. Blurring every rank/grid path was expensive on phones.
  g.shadowColor = '#FFBD46';g.shadowBlur = 9 * Math.sin(Math.PI * t);
  paint.box(-pose.w/2,-pose.h/2,pose.w,pose.h,6,'#FFE5A2');
  g.shadowBlur = 0;
  paint.card(card,-pose.w/2,-pose.h/2,pose.w,pose.h,'',false);
  if (kind === 'play' && pose.travel < 1) paint.box(-pose.w/2,-pose.h/2,pose.w,pose.h,6,null,'#FFE8A2',1.5);
  g.restore();
}

module.exports = {
  dealDuration, dealFrame, handLayout, handCardPose, clampHandPose, seatPoint, playGap, playDuration, flyingCard,
  eatImpact, HAND_X, HAND_WIDTH, CARD_WIDTH, PLAY_FLIGHT,
  drawDuration, drawFrame, drawGap, DRAW_FLIGHT,
  motionPose, landingGlow, cardReveal, DEAL_FLIGHT,
};
