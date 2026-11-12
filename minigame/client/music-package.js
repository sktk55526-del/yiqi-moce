'use strict';
const { createMusicBus } = require('./music');
const { createSubpackageLoader } = require('./subpackage');
function createPackagedMusic(wx, profiler) {
  return createDeferredMusic(createMusicBus(() => wx.createInnerAudioContext(), track => 'table-music/' + track + '.mp3'),
    createSubpackageLoader(wx, 'table-music', { profiler }));
}
function createDeferredMusic(bus, ensure, now = Date.now) {
  let desired = null, loading = false, ready = false, retryAt = 0;
  return {
    play(track) {
      desired = ['music-lobby', 'music-table'].includes(track) ? track : null;
      if (!desired) { bus.play(null); return; }
      if (ready) { bus.play(desired); return; }
      if (loading || now() < retryAt) return;
      loading = true;
      ensure(ok => {
        loading = false; ready = ok;
        if (!ok) { retryAt = now() + 5000; return; }
        // The user may have muted, left the page or put WeChat in the background.
        if (desired) bus.play(desired);
      });
    },
    duck: duration => bus.duck(duration), restore: () => bus.restore(),
  };
}
module.exports = { createPackagedMusic, createDeferredMusic };
