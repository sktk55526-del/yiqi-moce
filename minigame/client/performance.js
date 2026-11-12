'use strict';
const VERSION = require('../shared/version');
// Local diagnostics only. No room codes, names, credentials, URLs or device identifiers.
function createPerformance({ origin = Date.now(), now = Date.now, emit = value => console.info('[moce performance]', JSON.stringify(value)) } = {}) {
  const marks = {}, recent = []; let resumeEnd;
  const elapsed = () => Math.max(0, now() - origin);
  const record = event => { recent.push(event); if (recent.length > 60) recent.shift(); emit({ version: VERSION, ...event }); };
  const api = {
    mark(name) { if (marks[name] !== undefined) return; marks[name] = elapsed(); record({ name, ms: marks[name], kind: 'since-js-entry' }); },
    span(name) {
      const start = now(); let finished = false;
      return (status = 'ready') => { if (finished) return; finished = true; record({ name, ms: Math.max(0, now() - start), status, kind: 'duration' }); };
    },
    resume() { resumeEnd = api.span('foreground-to-paint'); },
    painted() { resumeEnd?.(); resumeEnd = null; },
    snapshot() { return { version: VERSION, scope: 'local-js-only-excludes-wechat-download', marks: { ...marks }, recent: recent.map(e => ({ ...e })) }; },
    report() { emit(api.snapshot()); },
  };
  api.mark('entry'); return api;
}
module.exports = { createPerformance };
