'use strict';
function installShell({game,version,paths,images}) {
  let prompt, registration, dismissed=false, applying=false, cacheReady=false, startedWorker=false, caching=false;
  const standalone=()=>matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  const apple=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const wechat=/MicroMessenger/i.test(navigator.userAgent);
  function dialog(title,text,actions) {
    document.getElementById('pwa-dialog')?.remove();
    const d=document.createElement('dialog');d.id='pwa-dialog';
    const h=document.createElement('h2');h.textContent=title;d.append(h);
    for(const line of text){const p=document.createElement('p');p.textContent=line;d.append(p);}
    const row=document.createElement('div');row.className='actions';
    for(const [label,action] of actions){const b=document.createElement('button');b.textContent=label;b.onclick=()=>{d.close();d.remove();action?.();};row.append(b);}
    d.append(row);d.addEventListener('close',()=>d.remove(),{once:true});document.body.append(d);d.showModal();
  }
  async function install() {
    if(standalone()){game.toast('已从手机桌面打开');return;}
    if(prompt){const current=prompt;prompt=null;await current.prompt();await current.userChoice;return;}
    dialog('添加到手机桌面',wechat
      ? ['请先点微信右上角“…”选择在浏览器打开。',apple?'再在 Safari 中点“分享 → 添加到主屏幕”，如出现“作为网页 App 打开”，请打开它。':'再打开浏览器菜单，选择“安装应用”或“添加到主屏幕”。']
      : apple?['在 Safari 中点“分享 → 添加到主屏幕”。','如出现“作为网页 App 打开”，请打开它，再点“添加”。','以后点桌面的“一起抹车”图标即可进入。']
      : ['打开浏览器右上角菜单，选择“安装应用”或“添加到主屏幕”。','如果没有安装选项，请使用最新版 Chrome 或支持安装网页应用的浏览器。'],[['知道了']]);
  }
  function about() {
    dialog('一起抹车 · 桌面版',[
      '版本 '+version+' · 广东纸牌，好友同桌。',
      cacheReady?'离线资源已备好，可断网进行人机练习。':caching?'正在下载离线资源，可继续联网游戏。':'画面按需加载。需要完整离线练习时，可下载离线资源；好友房需要联网。',
      '回消息后重新打开会恢复连接。浏览器与桌面版可能分别保存记录，请固定一个入口使用。',
      '通过房间内“邀请好友”发送链接，或把六位房间号告诉朋友。',
    ],[['添加到桌面',install],['下载离线资源',()=>{const worker=navigator.serviceWorker?.controller;if(worker){caching=true;worker.postMessage({type:'CACHE_REST'});game.toast('开始下载离线资源，可继续联网游戏');}else game.toast('首页资源准备完成后，请再试一次');}],['检查更新',()=>registration?.update().then(()=>game.toast(registration.waiting?'新版已准备好，返回首页更新':'已检查更新，下载完成后会提示')).catch(()=>game.toast('联网后再检查更新'))],['返回游戏']]);
  }
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();prompt=event;});
  window.addEventListener('appinstalled',()=>{prompt=null;game.toast('已添加到手机桌面');});
  const safe=()=>game.page==='home'&&!game.room&&!game.practice&&!game.overlay&&!document.querySelector('dialog[open]');
  const update=document.getElementById('update');
  const poll=setInterval(()=>{update.hidden=!(registration?.waiting&&!dismissed&&safe());showWelcome();},1200);
  document.getElementById('later-update').onclick=()=>{dismissed=true;update.hidden=true;};
  document.getElementById('apply-update').onclick=()=>{if(!safe()||!registration?.waiting)return;applying=true;registration.waiting.postMessage({type:'ACTIVATE'});};
  function startWorker(){
    if(startedWorker||!('serviceWorker' in navigator))return;startedWorker=true;
    navigator.serviceWorker.addEventListener('controllerchange',()=>{navigator.serviceWorker.controller?.postMessage({type:'OFFLINE_STATUS'});if(applying)location.reload();});
    navigator.serviceWorker.addEventListener('message',event=>{
      if(event.data?.type==='OTHER_WINDOWS'){applying=false;game.toast('请先关闭其他游戏窗口，再更新');}
      if(['CACHE_STATUS','CACHE_PROGRESS','CACHE_ERROR'].includes(event.data?.type)){
        cacheReady=event.data.ready===true;
        if(caching&&cacheReady){caching=false;game.toast('离线资源已下载完成');}
        if(event.data.type==='CACHE_ERROR'){caching=false;game.toast('下载暂时中断，已保留进度，可稍后继续');}
      }
    });
    navigator.serviceWorker.register(paths.asset('sw.js'),{scope:paths.base,updateViaCache:'none'}).then(r=>{
      registration=r;navigator.serviceWorker.controller?.postMessage({type:'OFFLINE_STATUS'});
      r.addEventListener('updatefound',()=>{const worker=r.installing;worker?.addEventListener('statechange',()=>{if(worker.state==='installed')dismissed=false;});});
    }).catch(()=>{});
    let checked=Date.now();
    document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-checked>60000){checked=Date.now();registration?.update().catch(()=>{});}});
  }
  let welcomed=false;
  const welcomeKey=paths.storagePrefix+'moce.pwa.welcome';
  try{welcomed=localStorage.getItem(welcomeKey)==='1';}catch{}
  function showWelcome(){
    if(welcomed||standalone()||new URLSearchParams(location.search).has('room')||game.page!=='home'||document.getElementById('loading'))return;
    welcomed=true;
    const remember=()=>{try{localStorage.setItem(welcomeKey,'1');}catch{}};
    dialog('好友同桌，随时开局',['安卓和苹果都能在这里一起玩。','可以直接开始，也可以添加到手机桌面。安装说明以后可在“设置 → 关于”查看。'],[['开始游戏',remember],['添加到桌面',()=>{remember();install();}]]);
  }
  const loading=document.getElementById('loading'),retry=document.getElementById('retry'),continueButton=document.getElementById('continue-loading');
  const imageStatus=document.getElementById('image-status'),imageText=document.getElementById('image-status-text');
  loading.dataset.gameReady='1';
  function retryImages(){images.retry();game.themeImages?.retry();for(const [key,state] of game.imageStates)if(state==='failed')game.imageStates.delete(key);game.loadPageImages();game.invalidate();}
  retry.onclick=retryImages;retry.textContent='重试图片';document.getElementById('retry-images').onclick=retryImages;
  continueButton.onclick=()=>{loading.remove();startWorker();};
  const unsubscribe=images.subscribe(state=>{
    const count=['ui-home-compact','ui-home-wordmark'].filter(key=>game.images[key]).length;
    if(count===2||game.page!=='home'){loading.remove();startWorker();}
    else if(loading.isConnected){
      document.getElementById('loading-text').textContent=state.failed?'画面暂时未能下载，请重试。':state.slow?'网络较慢，画面仍在下载中…':'正在准备首页画面（'+count+'/2）…';
      retry.hidden=continueButton.hidden=!(state.slow||state.failed);
    }
    imageStatus.hidden=loading.isConnected||!(state.slow||state.failed);
    imageText.textContent=state.failed?'部分图片未加载，点击重试即可补全。':'网络较慢，正在补全画面…';
  });
  window.addEventListener('online',retryImages);
  const foregroundRetry=()=>{if(!document.hidden)retryImages();};document.addEventListener('visibilitychange',foregroundRetry);
  return {about,install,dispose(){clearInterval(poll);unsubscribe();window.removeEventListener('online',retryImages);document.removeEventListener('visibilitychange',foregroundRetry);}};
}
module.exports={installShell};
