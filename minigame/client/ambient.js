'use strict';
function createAmbient(createPlayer, source) {
  let player, current;
  return theme => {
    if (!theme) { player?.pause(); return; }
    if (!player) { player = createPlayer(); player.loop = true; player.volume = .18; }
    if (current !== theme) { player.pause(); current = theme; player.src = source(theme); }
    if (player.paused) player.play()?.catch?.(() => {});
  };
}
module.exports = { createAmbient };
