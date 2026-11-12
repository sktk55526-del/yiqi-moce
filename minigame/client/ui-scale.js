'use strict';
// Compact supporting UI. Card indices use their own geometry in card-face.js.
function textSize(size){
  if(size<=11)return size;
  if(size<=14)return Math.max(11,size*.92);
  if(size<=20)return size*.85;
  return size*(size>45?.86:.78);
}
const avatarRadius=radius=>radius*.72;
module.exports={textSize,avatarRadius};
