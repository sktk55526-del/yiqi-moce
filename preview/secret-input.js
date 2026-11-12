'use strict';
function editSecret(value,done){
 const dialog=document.createElement('dialog'),form=document.createElement('form'),label=document.createElement('label'),input=document.createElement('input');
 dialog.style.cssText='box-sizing:border-box;background:#fff0cf;color:#103d31;border:2px solid #c99b4b;border-radius:18px;padding:20px;width:min(360px,calc(100vw - 24px - var(--moce-safe-left,0px) - var(--moce-safe-right,0px)));max-height:calc(100% - 24px - var(--moce-safe-top,0px) - var(--moce-safe-bottom,0px));inset:var(--moce-safe-top,0px) var(--moce-safe-right,0px) var(--moce-safe-bottom,0px) var(--moce-safe-left,0px);overflow:auto;margin:auto;font:16px system-ui';
 label.textContent='管理员密码';input.type='password';input.value=value;input.maxLength=256;input.autocomplete='off';input.setAttribute('aria-label','管理员密码');
 input.style.cssText='box-sizing:border-box;width:100%;margin:15px 0 20px;padding:12px;border:1px solid #bca46e;border-radius:9px;font:18px system-ui;background:#fff9e8';
 const cancel=document.createElement('button'),save=document.createElement('button');cancel.type='button';cancel.textContent='取消';save.type='submit';save.textContent='确认输入';
 const actions=document.createElement('div');actions.style.cssText='display:flex;gap:10px;flex-wrap:wrap';
 for(const b of [cancel,save])b.style.cssText='flex:1;min-width:100px;min-height:44px;padding:10px;border:1px solid #bca46e;border-radius:8px;background:#edc36d;color:#173b30;font:15px system-ui';
 let finished=false;const finish=value=>{if(finished)return;finished=true;input.value='';dialog.close();dialog.remove();done(value);};
 cancel.onclick=()=>finish(null);dialog.oncancel=e=>{e.preventDefault();finish(null);};form.onsubmit=e=>{e.preventDefault();finish(input.value);};
 actions.append(cancel,save);label.append(input);form.append(label,actions);dialog.append(form);document.body.append(dialog);dialog.showModal();input.focus();return ()=>finish(null);
}
module.exports={editSecret};
