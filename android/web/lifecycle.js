'use strict';

// Only resume an existing seat after network changes. Never replay a create/join/move.
function createAndroidLifecycle({game,stopSound=()=>{},screen=()=>{}}) {
  let active=true,online=true,lastScreen=false;
  function syncScreen() {
    const value=active&&game.page==='table'&&!!game.room?.round&&!game.room.round.result;
    if(value!==lastScreen){lastScreen=value;screen(value);}
  }
  function setActive(value) {
    value=!!value;if(value===active)return;
    active=value;
    if(active)game.foreground();
    else{game.background();stopSound();}
    syncScreen();
  }
  function networkChanged(value,changed=false) {
    value=!!value;const wasOnline=online;online=value;
    if(!active)return;
    if(!online){
      if(game.online.socket||game.online.retry){
        game.online.disconnect();
        if(!game.online.session)game.toast('网络已断开，恢复后请重新加入');
      }
      if(game.online.session&&!game.online.session.parked&&!game.practice){
        game.connecting='网络已断开，恢复后自动重连';game.invalidate();
      }
    }else if(changed||!wasOnline){
      const session=game.online.session;
      if(session&&!session.parked&&!game.practice&&!game.tutorial&&!game.challenge){
        game.online.disconnect();game.online.reconnect();
      }
    }
  }
  return {setActive,networkChanged,syncScreen};
}
module.exports={createAndroidLifecycle};
