'use strict';
const { createSubpackageLoader } = require('./subpackage');
const { loadImage } = require('./image-loader');
const FILES = ['clean-background.jpg','botanical-frame.png','felt-background.jpg','salon-background.jpg','brand-mark.png',...Array.from({length:6},(_,i)=>'portrait-'+i+'.jpg')];
function createWechatUiLoader(wx, profiler) {
  const ensure = createSubpackageLoader(wx,'ui-art',{profiler});
  const ensureFx = createSubpackageLoader(wx,'table-fx',{profiler});
  const image = (file,done)=>{
    if (!/^[a-z0-9-]+\.(jpg|png)$/.test(file)) {done(null);return;}
    const fx=['action-fx-atlas.png','card-back-reference.jpg'].includes(file);
    (fx?ensureFx:ensure)(ok=>{if(ok)loadImage(()=>wx.createImage(),(fx?'table-fx/':'ui-art/')+file,done);else done(null);});
  };
  image.font = done => {
    if (!wx.loadFont) { done(null); return; }
    ensure(ok => {
      if (!ok) { done(null); return; }
      let family = null;
      try { family = wx.loadFont('ui-art/ui-sans.ttf') || null; }
      catch { /* Keep the system-font fallback usable. */ }
      done(family);
    });
  };
  return image;
}
function loadUiArt(game) {
  if (!game.platform.uiImage) return;
  // Home is a separate first-request atlas; decorative assets follow it on demand.
  const files = game.page === 'home' ? ['home-compact.jpg','home-wordmark.png'] : [...FILES,'home-compact.jpg','tea-cup.png',
    ...(['table','spectator','tutorial','replay','warReport','scoreDetail','challenge'].includes(game.page)?['card-paper.jpg']:[]),
    ...(['table','spectator','tutorial','replay','warReport'].includes(game.page)?['scene-reference.jpg']:[]),
    ...(game.page==='table'?['action-fx-atlas.png','card-back-reference.jpg']:[]),
    ...(game.page==='result'?['winner-trophy.png','title-result.png']:[]),
    ...(game.page==='matchBoard'?['title-match.png']:[]),
    ...(game.page==='records'?['title-records.png']:[]),
    ...(game.page==='awards'?Array.from({length:5},(_,i)=>'award-'+i+'.png'):[]),
    ...(game.page==='themes'?Array.from({length:6},(_,i)=>'theme-scene-'+i+'.jpg'):[]),
    ...(game.overlay==='social'?Array.from({length:6},(_,i)=>'reaction-'+i+'.jpg'):[])];
  for (const file of files) {
    const name='ui-'+file.replace(/\.(png|jpg)$/,'');
    if(game.imageStates.has(name))continue;
    game.imageStates.set(name,'loading');
    game.platform.uiImage(file,image=>{
      game.imageStates.set(name,image?'ready':'failed');
      if(image)game.images[name]=image;
      game.invalidate();
    });
  }
}
module.exports={createWechatUiLoader,loadUiArt};
