'use strict';
// Reuse one gesture-unlocked AudioContext. iOS may reject new HTMLAudio elements
// created later by remote players' moves, even after music has started.
function createWebAudio(scope = window) {
  let context;
  const buffers = new Map();
  function unlock() {
    const Constructor = scope.AudioContext || scope.webkitAudioContext;
    if (!Constructor) return;
    context ||= new Constructor();
    if (context.state !== 'running') context.resume().catch(() => {});
    const source = context.createBufferSource();
    source.buffer = context.createBuffer(1, 1, context.sampleRate);
    source.connect(context.destination); source.start();
  }
  async function buffer(src) {
    if (!buffers.has(src)) buffers.set(src, fetch(src).then(r => {
      if (!r.ok) throw new Error('Audio unavailable');
      return r.arrayBuffer();
    }).then(data => context.decodeAudioData(data)).catch(error => { buffers.delete(src); throw error; }));
    return buffers.get(src);
  }
  function createPlayer() {
    if (!(scope.AudioContext || scope.webkitAudioContext)) return new Audio();
    let source, gain, serial = 0, paused = true, volume = 1;
    return {
      src: '', loop: false, onended: null, onerror: null,
      get paused() { return paused; },
      get volume() { return volume; },
      set volume(value) { volume = value; if (gain) gain.gain.value = value; },
      async play() {
        if (!context) throw new Error('Touch the screen to enable audio');
        if (!paused) return;
        const id = ++serial; paused = false;
        try {
          const data = await buffer(this.src);
          if (id !== serial) return;
          source = context.createBufferSource(); gain = context.createGain();
          source.buffer = data; source.loop = this.loop; gain.gain.value = volume;
          source.connect(gain); gain.connect(context.destination);
          source.onended = () => { if (id === serial) { paused = true; source.disconnect(); gain.disconnect(); this.onended?.(); } };
          source.start();
        } catch (error) { if (id === serial) { paused = true; this.onerror?.(); } throw error; }
      },
      pause() { serial++; paused = true; if (source) { source.onended = null; try { source.stop(); } catch {} source.disconnect(); source = null; } gain?.disconnect(); },
    };
  }
  return { unlock, createPlayer, suspend() { context?.suspend().catch(() => {}); }, get state() { return (scope.AudioContext || scope.webkitAudioContext) ? context?.state || 'locked' : 'html-audio'; } };
}
module.exports = { createWebAudio };
