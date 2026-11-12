'use strict';
function editName(value, done, onInput) {
  const dialog = document.createElement('dialog'), form = document.createElement('form');
  dialog.style.cssText = 'box-sizing:border-box;background:#fff0cf;color:#103d31;border:2px solid #c99b4b;border-radius:20px;padding:20px;width:min(360px,calc(100vw - 24px - var(--moce-safe-left,0px) - var(--moce-safe-right,0px)));max-height:calc(100% - 24px - var(--moce-safe-top,0px) - var(--moce-safe-bottom,0px));inset:var(--moce-safe-top,0px) var(--moce-safe-right,0px) var(--moce-safe-bottom,0px) var(--moce-safe-left,0px);overflow:auto;margin:auto;font-family:system-ui;box-shadow:0 18px 80px #0008';
  const title = document.createElement('h3'); title.textContent = '你的牌桌名称'; title.style.marginTop = '0';
  const input = document.createElement('input'); input.value = value; input.maxLength = 8; input.setAttribute('aria-label','你的名称');
  input.placeholder = '留空使用默认名称'; input.autocomplete = 'off';
  input.style.cssText = 'box-sizing:border-box;width:100%;padding:12px;border:1px solid #bca46e;border-radius:10px;font:18px system-ui;background:#fff9e8';
  const note = document.createElement('p'); note.textContent = '最多 8 个字，入座后全桌可见。'; note.style.fontSize = '13px';
  const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = '取消';
  const save = document.createElement('button'); save.type = 'submit'; save.textContent = '保存名称';
  const actions=document.createElement('div');actions.style.cssText='display:flex;gap:10px;flex-wrap:wrap';
  for (const b of [cancel,save]) b.style.cssText='flex:1;min-width:100px;min-height:44px;padding:10px;border:1px solid #c5a76a;border-radius:10px;background:#edc36d;color:#173b30;font:16px system-ui;cursor:pointer';
  let finished = false;
  const finish = name => { if (finished) return; finished = true; dialog.close(); dialog.remove(); done(name); };
  input.oninput = () => onInput?.(input.value);
  cancel.onclick = () => finish(null); dialog.oncancel = event => { event.preventDefault(); finish(null); };
  form.onsubmit = event => { event.preventDefault(); finish(input.value); };
  actions.append(cancel,save);form.append(title,input,note,actions); dialog.append(form); document.body.append(dialog); dialog.showModal(); input.focus(); input.select();
  return () => finish(null);
}
module.exports = { editName };
