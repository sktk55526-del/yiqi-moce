'use strict';
const { safeAreaForRect } = require('../android/web/safe-area');
function createViewport(canvas) {
  const probe = document.getElementById('safe-probe');
  function update() {
    const viewport = window.visualViewport;
    const height = viewport?.height || innerHeight;
    document.documentElement.style.setProperty('--app-height', height + 'px');
    document.documentElement.style.setProperty('--app-top', (viewport?.offsetTop || 0) + 'px');
  }
  function size() {
    const style = getComputedStyle(probe);
    const raw = {top:parseFloat(style.paddingTop)||0,bottom:parseFloat(style.paddingBottom)||0,
      left:parseFloat(style.paddingLeft)||0,right:parseFloat(style.paddingRight)||0};
    return { width: canvas.clientWidth, height: canvas.clientHeight, ratio: devicePixelRatio,
      ...safeAreaForRect(raw,canvas.getBoundingClientRect(),{width:innerWidth,height:visualViewport?.height||innerHeight},1) };
  }
  update();
  return { update, size };
}
module.exports = { createViewport };
