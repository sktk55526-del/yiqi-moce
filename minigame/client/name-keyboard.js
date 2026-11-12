'use strict';
const { NAME_LIMIT } = require('../shared/nickname');
function editWechatName(wx, value, done, input = () => {}) {
  if (!wx.showKeyboard || !wx.onKeyboardConfirm || !wx.onKeyboardComplete) { done(null, '微信版本暂不支持名称输入'); return () => {}; }
  let finished = false;
  const finish = (name, error) => {
    if (finished) return;
    finished = true;
    wx.offKeyboardConfirm?.(confirm); wx.offKeyboardComplete?.(complete); wx.offKeyboardInput?.(change);
    done(name, error);
  };
  const confirm = event => { finish(event.value); wx.hideKeyboard?.({ fail() {} }); };
  const complete = event => finish(event.value);
  const change = event => input(event.value);
  wx.onKeyboardConfirm(confirm); wx.onKeyboardComplete(complete); wx.onKeyboardInput?.(change);
  try { wx.showKeyboard({ defaultValue: value, maxLength: NAME_LIMIT, keyboardType: 'text', multiple: false, confirmHold: false, confirmType: 'done',
    fail: () => finish(null, '键盘打开失败，请重试') }); } catch { finish(null, '键盘打开失败，请重试'); }
  return () => { finish(null); wx.hideKeyboard?.({ fail() {} }); };
}
module.exports = { editWechatName };
