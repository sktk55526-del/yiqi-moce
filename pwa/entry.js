'use strict';
const {Game}=require('../minigame/client/game');
const {createPerformance}=require('../minigame/client/performance');
const {loadImage}=require('../minigame/client/image-loader');
const {editName}=require('../preview/name-input');
const {editSecret}=require('../preview/secret-input');
const {createMusicBus}=require('../minigame/client/music');
const {createVoiceBus,voiceFile}=require('../minigame/client/voice');
const {createAmbient}=require('../minigame/client/ambient');
const {createCardAudio}=require('../minigame/client/card-audio');
const {createAndroidLifecycle}=require('../android/web/lifecycle');
const {createWebAudio}=require('./audio');
const {createStorage}=require('./storage');
const {createViewport}=require('./viewport');
const {installShell}=require('./shell');
const {appPaths}=require('./paths');
const paths=appPaths(document.baseURI),asset=paths.asset;
const config=require('./config');
const canvas=document.getElementById('game'),viewport=createViewport(canvas),audio=createWebAudio();
const music=createMusicBus(audio.createPlayer,track=>asset('table-music/'+track+'.mp3'));
const ambient=createAmbient(audio.createPlayer,theme=>asset('assets/ambient-'+theme+'.wav'));
function clip(src,done,volume){const a=audio.createPlayer();a.src=src;a.volume=volume;a.onended=done;a.onerror=done;return{play:()=>a.play(),stop(){a.onended=null;a.onerror=null;a.pause();}};}
const voice=createVoiceBus((src,done)=>clip(src,done,.8),type=>asset('assets/'+voiceFile(type)),music);
const cards=createCardAudio((src,done)=>clip(src,done,.32),type=>asset('assets/card-'+type+'.wav'));
let game,shell,storageWarning=false;
let persistent;try{persistent=localStorage;}catch{persistent={getItem(){throw Error();},setItem(){throw Error();}};}
const nativeStorage=persistent;
persistent={getItem:key=>nativeStorage.getItem(paths.storagePrefix+key),setItem:(key,value)=>nativeStorage.setItem(paths.storagePrefix+key,value),removeItem:key=>nativeStorage.removeItem(paths.storagePrefix+key)};
const storage=createStorage(persistent,crypto.randomUUID?.()||String(Date.now())+Math.random(),()=>{if(!storageWarning){storageWarning=true;setTimeout(()=>game.toast('浏览器未允许保存记录，请勿清除或关闭当前页面'),0);}});
const platform={
  canvas,editName,editSecret,profiler:createPerformance(),appVersion:config.version+' Web',appInfo:()=>shell.about(),
  isOnline:()=>navigator.onLine,socketUrl:config.socketUrl,socketTimeout:20000,
  read:storage.read,write:storage.write,size:viewport.size,frame:cb=>requestAnimationFrame(cb),
  createCanvas:()=>document.createElement('canvas'),
  image(file,done){loadImage(()=>new Image(),asset('assets/'+file),done);},
  themeImage(file,done){loadImage(()=>new Image(),asset('table-themes/'+file),done);},
  uiImage(file,done){loadImage(()=>new Image(),asset((['action-fx-atlas.png','card-back-reference.jpg'].includes(file)?'table-fx/':'ui-art/')+file),done);},
  uiFont(done){let ended=false;const finish=v=>{if(!ended){ended=true;clearTimeout(timer);done(v);}};const timer=setTimeout(()=>finish(null),8000);
    if(!window.FontFace){finish(null);return;}const face=new FontFace('Moce UI Sans','url("'+asset('ui-art/ui-sans.ttf')+'")');face.load().then(f=>{document.fonts.add(f);finish('Moce UI Sans');},()=>finish(null));},
  openSocket(events){const socket=new WebSocket(platform.socketUrl);socket.onopen=events.open;socket.onmessage=e=>events.message(e.data);socket.onclose=e=>events.close(e.code,e.reason);socket.onerror=()=>{};return{send:data=>socket.send(data),close:()=>socket.close()};},
  async copy(text,done){try{await navigator.clipboard.writeText(String(text));done(true);}catch{window.prompt('长按复制下方内容',String(text));done(false);}},
  async share(code,title){const url=paths.invite(code);
    if(navigator.share){try{await navigator.share({title:title||'一起抹车',text:'来一起抹车，房间号：'+code,url:url.href});return;}catch(e){if(e.name==='AbortError')return;}}
    platform.copy(url.href,ok=>{if(ok)game.toast('邀请链接已复制，发给好友即可');});},
  exportImage(image,done){image.toBlob(async blob=>{if(!blob){done(false);return;}const file=new File([blob],'一起抹车-战报.png',{type:'image/png'});
    if(navigator.canShare?.({files:[file]})){try{await navigator.share({files:[file],title:'一起抹车战报'});done(true);return;}catch(e){if(e.name==='AbortError'){done(false);return;}}}
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=file.name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);done(true);},'image/png');},
  music:track=>music.play(track),ambient,sound:(type,social)=>voice.play(type,social),cardSound:type=>cards.play(type),
  stopSound(){voice.stop();cards.stop();},vibrate(){navigator.vibrate?.(25);},
};
game=new Game(platform);
let wakeLock,wantsWake=false;
async function keepScreen(value){wantsWake=value;if(!value){wakeLock?.release().catch(()=>{});wakeLock=null;return;}if(wakeLock||!navigator.wakeLock||document.hidden)return;try{const lock=await navigator.wakeLock.request('screen');if(!wantsWake){await lock.release();return;}wakeLock=lock;lock.addEventListener('release',()=>{if(wakeLock===lock)wakeLock=null;});}catch{}}
const lifecycle=createAndroidLifecycle({game,stopSound(){voice.stop();cards.stop();audio.suspend();},screen:keepScreen});
const render=game.render.bind(game);game.render=()=>{render();lifecycle.syncScreen();};
function resize(){viewport.update();requestAnimationFrame(()=>game.resize());}
function point(e){const r=canvas.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};}
document.addEventListener('pointerdown',()=>{audio.unlock();game.syncMusic();if(wantsWake)keepScreen(true);},{capture:true});
canvas.onpointerdown=e=>{canvas.setPointerCapture(e.pointerId);game.pointerDown(point(e));};
canvas.onpointermove=e=>game.pointerMove(point(e));canvas.onpointerup=e=>game.pointerUp(point(e));canvas.onpointercancel=()=>game.pointerCancel();
canvas.onwheel=e=>{e.preventDefault();game.wheel(e.deltaY||e.deltaX);};
window.addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',resize);window.visualViewport?.addEventListener('scroll',resize);
window.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey||e.target?.closest?.('input,textarea,select,dialog'))return;audio.unlock();if(game.key(e.key))e.preventDefault();});
const invite=()=>new URLSearchParams(location.search).get('room');
window.addEventListener('pagehide',()=>lifecycle.setActive(false));
window.addEventListener('pageshow',()=>{lifecycle.setActive(true);resize();});
document.addEventListener('visibilitychange',()=>{lifecycle.setActive(!document.hidden);if(!document.hidden){resize();if(wantsWake)keepScreen(true);}});
window.addEventListener('offline',()=>lifecycle.networkChanged(false));window.addEventListener('online',()=>lifecycle.networkChanged(true));
shell=installShell({game,version:config.version,paths});
document.getElementById('loading').remove();game.foreground(invite());
// Removed entirely by the public build; visual QA can inspect a separate local bundle.
if(MOCE_PWA_DEBUG)window.__moceTest={game,platform,audio,viewport,lifecycle,shell,fixture:require('../preview/ui-fixtures').fixture};
