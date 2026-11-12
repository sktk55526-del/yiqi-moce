'use strict';
const cantonese = require('../shared/cantonese');
const { SUIT_NAMES } = require('../shared/rules');

// One spoken cue at a time so rapid reports and penalty stacks remain intelligible.
function createVoiceBus(createPlayer, source, music) {
  const queue = [];
  let active = null;
  let timer = null;

  function next() {
    if (active || !queue.length) return;
    const { type, social } = queue.shift();
    const cue = { social, type };
    active = cue;
    const finish = () => {
      if (active !== cue) return;
      clearTimeout(timer);
      cue.player?.stop();
      active = null;
      music.restore();
      next();
    };
    music.duck(6000);
    timer = setTimeout(finish, 5000);
    try {
      cue.player = createPlayer(source(type), finish);
      cue.player.play()?.catch?.(finish);
    } catch { finish(); }
  }

  return {
    play(type, social = false) {
      // Optional chatter must never delay a report or an accumulating penalty call.
      if (social && (active || queue.length)) return false;
      const kind = name => name.replace(/^yue-/, '').replace(/^(suit|penalty)-.*/, '$1');
      if (!social && (active?.social || active && kind(type) === 'suit' && kind(active.type) === 'suit')) {
        clearTimeout(timer);
        const player = active.player;
        active = null; player?.stop(); music.restore();
      }
      // Keep the latest state call of each kind, rather than dropping important
      // cues indiscriminately. At most five gameplay kinds can be queued.
      if (!social) for (let i = queue.length - 1; i >= 0; i--) {
        if (queue[i].social || kind(queue[i].type) === kind(type)) queue.splice(i, 1);
      }
      queue.push({ type, social }); next(); return true;
    },
    stop() {
      queue.length = 0;
      clearTimeout(timer);
      const player = active?.player;
      active = null;
      player?.stop();
      music.restore();
    },
  };
}

function voiceFile(type) { return type + (/^(yue-|social-|suit-)/.test(type) ? '.mp3' : '.wav'); }
function suitName(suit, language) {
  return language === 'yue' ? (cantonese.clips['suit-' + suit] || '').replace(/[！。]$/, '') : SUIT_NAMES[suit] || '';
}
module.exports = { createVoiceBus, voiceFile, suitName };
