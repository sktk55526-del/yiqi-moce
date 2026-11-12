'use strict';
// Card foley is independent of the serialized spoken announcements.
function createCardAudio(createPlayer,source){
 const active=new Set();
 function stop(){for(const cue of active){clearTimeout(cue.timer);cue.player?.stop();}active.clear();}
 return {stop,play(type){
  if(!['deal','play','draw'].includes(type))return;
  if(active.size>=2){const first=active.values().next().value;clearTimeout(first.timer);first.player?.stop();active.delete(first);}
  const cue={};active.add(cue);
  const done=()=>{if(!active.delete(cue))return;clearTimeout(cue.timer);cue.player?.stop();};
  cue.timer=setTimeout(done,700);
  try{cue.player=createPlayer(source(type),done);cue.player.play()?.catch?.(done);}catch{done();}
 }};
}
module.exports={createCardAudio};
