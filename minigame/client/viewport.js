'use strict';
const WIDTH=390,MIN_CONTENT_HEIGHT=650;
const inset=value=>Number.isFinite(value)?Math.max(0,value):0;
function fitViewport(size){
 const {width,height}=size;
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<200||height<240)return null;
 const top=inset(size.top),bottom=inset(size.bottom),left=inset(size.left),right=inset(size.right);
 if(width-left-right<160||height-top-bottom<200)return null;
 // Reserve space for content AFTER system insets. Each upper bound corresponds
 // to one combination of the minimum padding and device-provided safe edges.
 const scale=Math.min((width-left-right)/WIDTH,height/(MIN_CONTENT_HEIGHT+25),
  (height-top-bottom)/(MIN_CONTENT_HEIGHT+9),
  (height-top)/(MIN_CONTENT_HEIGHT+16),(height-bottom)/(MIN_CONTENT_HEIGHT+18));
 return {scale,offset:left+(width-left-right-WIDTH*scale)/2,height:height/scale,
  top:Math.max(13,top/scale+4),bottom:Math.max(12,bottom/scale+5),
  pixelRatio:Math.max(1,Math.min(3,Number.isFinite(size.ratio)?size.ratio:1))};
}
module.exports={fitViewport,MIN_CONTENT_HEIGHT};
