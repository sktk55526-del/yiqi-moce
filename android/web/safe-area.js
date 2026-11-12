'use strict';
// Native insets are physical pixels relative to the whole WebView. A centered
// canvas can already be clear of a side cutout: only reserve the overlap.
function safeAreaForRect(raw,rect,viewport,ratio){
 const d=Number.isFinite(ratio)&&ratio>0?ratio:1;
 const edge=key=>Number.isFinite(raw?.[key])?Math.max(0,raw[key])/d:0;
 return {left:Math.max(0,edge('left')-rect.left),top:Math.max(0,edge('top')-rect.top),
  right:Math.max(0,edge('right')-(viewport.width-rect.right)),bottom:Math.max(0,edge('bottom')-(viewport.height-rect.bottom))};
}
module.exports={safeAreaForRect};
