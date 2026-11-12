'use strict';
const { C } = require('./paint');

// A compact identity area beside the controls leaves the entire hand row free.
function drawSelfPlayer(game, actionY, count, dealing = false) {
  const { paint: p, room, images } = game;
  const player = room.players[room.self], round = room.round;
  const x = 46, y = actionY + 17, baseRadius = 24, radius = p.avatarRadius(baseRadius);
  const active = !dealing && round.turn === room.self && !round.result;
  const name = player.name || '你';
  if (active) p.circle(x, y, radius + 3, round.penalty ? '#9B3425' : '#7F6129', round.penalty ? C.hot : '#FBD077', 1.2);
  p.avatar(images['avatar' + player.avatar], x, y, baseRadius, name.slice(-1));
  const badge = player.auto ? '托管' : !player.online ? '离线'
    : !dealing && round.reported?.[room.self] ? '报' : count + '张';
  p.box(x + 8, y + 2, 29, 17, 8, C.light, C.gold, .7);
  p.text(badge, x + 22.5, y + 10.5, 10, player.auto || !player.online ? C.red : C.ink, { max: 25 });
  p.box(x - 33, y + 21, 66, 14, 7, C.pine, C.gold, .7);
  p.text(name, x, y + 28, 12, C.cream, { max: 58 });
}

module.exports = { drawSelfPlayer };
