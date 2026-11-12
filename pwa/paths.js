'use strict';
function appPaths(href) {
  const base = new URL('./', href);
  return {
    base: base.href,
    asset: file => new URL(file.replace(/^\/+/, ''), base).href,
    storagePrefix: base.pathname === '/' ? '' : 'moce.site:' + base.pathname + ':',
    invite(code) { const url = new URL(base); url.searchParams.set('room', code); return url; },
  };
}
module.exports = { appPaths };
