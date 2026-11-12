'use strict';
document.getElementById('retry').onclick=()=>location.reload();
setTimeout(()=>{if(document.getElementById('loading')){document.getElementById('loading-text').textContent='首次打开需要下载画面。若等待较久，请检查网络后重试。';document.getElementById('retry').hidden=false;}},20000);
