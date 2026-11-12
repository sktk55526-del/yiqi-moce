'use strict';

const MUSIC_VOLUME = .25;
const DUCKED_VOLUME = .13;
const MUSIC_CREDITS = [
  'Hyperfun — Kevin MacLeod (incompetech.com)',
  'https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1400038',
  'Electrodoodle — Kevin MacLeod (incompetech.com)',
  'https://incompetech.com/music/royalty-free/index.html?Search=Search&isrc=USUAN1200079',
  'CC BY 4.0 — https://creativecommons.org/licenses/by/4.0/',
  '游戏版做了节选、接缝淡化、音量调整与 MP3 转码。',
].join('\n');

function createMusicBus(createPlayer, trackSource) {
  let player = null;
  let currentTrack = null;
  let duckTimer = null;

  function resetVolume() {
    clearTimeout(duckTimer);
    duckTimer = null;
    if (player) player.volume = MUSIC_VOLUME;
  }

  return {
    play(track) {
      if (!track) {
        player?.pause();
        resetVolume();
        return;
      }
      if (currentTrack !== track || !player) {
        player?.pause();
        resetVolume();
        player ??= createPlayer();
        player.src = trackSource(track);
        currentTrack = track;
        player.loop = true;
        player.volume = MUSIC_VOLUME;
      }
      if (player.paused) player.play()?.catch?.(() => {});
    },
    restore: resetVolume,
    duck(duration = 480) {
      if (!player || player.paused) return;
      clearTimeout(duckTimer);
      player.volume = DUCKED_VOLUME;
      duckTimer = setTimeout(resetVolume, duration);
    },
  };
}

module.exports = { createMusicBus, MUSIC_CREDITS };
