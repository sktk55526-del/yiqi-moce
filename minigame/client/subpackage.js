'use strict';
// One in-flight attempt per package. Timed-out callbacks cannot complete a later attempt.
function createSubpackageLoader(wx, name, options = {}) {
  let ready = false, active = null;
  const timeout = options.timeout ?? 15000;
  return done => {
    if (ready) { done(true); return; }
    if (active) { active.callbacks.push(done); return; }
    const attempt = { callbacks: [done] }; active = attempt;
    const end = options.profiler?.span('package:' + name);
    const finish = (ok, status) => {
      if (active !== attempt) return;
      clearTimeout(attempt.timer); active = null; ready = ok;
      end?.(status);
      for (const callback of attempt.callbacks) callback(ok);
    };
    attempt.timer = setTimeout(() => finish(false, 'timeout'), timeout);
    attempt.timer?.unref?.();
    if (!wx.loadSubpackage) { finish(false, 'unsupported'); return; }
    try { wx.loadSubpackage({ name, success: () => finish(true, 'ready'), fail: () => finish(false, 'failed') }); }
    catch { finish(false, 'failed'); }
  };
}
module.exports = { createSubpackageLoader };
