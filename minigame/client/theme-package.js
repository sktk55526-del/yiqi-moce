'use strict';
const { createSubpackageLoader } = require('./subpackage');
const { loadImage } = require('./image-loader');
function createWechatThemeLoader(wx, profiler) {
  const ensure = createSubpackageLoader(wx, 'table-themes', { profiler });
  return (file, done) => {
    if (!/^(table|thumb)-\d{2}\.jpg$/.test(file)) { done(null); return; }
    ensure(ok => {
      if (!ok) { done(null); return; }
      loadImage(() => wx.createImage(), 'table-themes/' + file, done);
    });
  };
}
module.exports = { createWechatThemeLoader };
