'use strict';
const {C}=require('./paint');
const {atlasSprite}=require('./table-effects');
const {plaque}=require('./reference-pages');
const {drawSelfPlayer}=require('./table-player');

// Real game state drives these compositions. Artwork contains no player data.
function scene(g){
 const p=g.paint,im=g.images['ui-salon-background'];
 if(im)p.ctx.drawImage(im,0,0,390,g.height*1.47);else p.box(0,0,390,g.height,0,C.pine);
 p.brand(110,g.top-5,170,55);
 return {p,q:g.room.round,r:g.room,b:g.height-g.bottom};
}
function eat(g){
 const {p,q,r,b}=scene(g),hy=b-258,fy=g.top+210,fh=Math.max(125,hy-fy-31);
 p.icon('≡',13,g.top+4,()=>g.openPartyPage('party'));p.icon('⚙',333,g.top+4,()=>g.open('settings'));
 const other=r.players.map((a,i)=>({...a,seat:i})).filter(a=>a.seat!==r.self);
 const actor=other.find(a=>a.seat===q.event?.seat)||other[0];
 if(actor){p.avatar(g.images['avatar'+actor.avatar],195,g.top+88,27,actor.name.slice(-1));plaque(p,actor.name,154,g.top+111,82,23);}
 p.card(q.top,163,g.top+142,64,89);
 other.filter(a=>a!==actor).forEach((a,i)=>{const x=i%2?351:39,y=fy+28+Math.floor(i/2)*79;p.avatar(g.images['avatar'+a.avatar],x,y,23,a.name.slice(-1));plaque(p,a.name,x-34,y+23,68,23,'paper');});
 if(!atlasSprite(p,'eat',195,fy+fh/2,270))p.heading('吃',195,fy+fh/2,100,C.gold);
 plaque(p,'整手合计相等，可以吃牌',55,hy-27,280,31,'paper');
 const count=q.hand.length,w=62,gap=Math.min(66,282/Math.max(1,count)),x=(390-(count-1)*gap-w)/2;
 q.hand.forEach((card,i)=>{p.ctx.save();p.ctx.translate(x+i*gap+w/2,hy+51);p.ctx.rotate((i-(count-1)/2)*.065);p.card(card,-w/2,-47,w,94);p.ctx.restore();});
 plaque(p,q.hand.map(c=>c.rank).join(' + ')+' = '+q.top.rank,82,hy+105,226,31,'paper');
 drawSelfPlayer(g,b-61,q.hand.length);
 const mustReport=q.hand.length===1&&!q.reported?.[r.self];
 p.button(mustReport?'先报牌':'吃牌',91,b-61,130,45,!g.busy&&!r.paused&&!g.connecting?()=>mustReport?g.report():g.eat():null);
 p.button('继续等待',231,b-61,142,45,()=>{g.eatPromptDismissed=[r.code||'practice',q.number,q.step].join(':');},'paper');
}
function drawReferenceMoment(g,now){
 if(g.page!=='table'||!g.room?.round||!g.platform.uiImage||g.overlay||g.connecting||g.room.round.result||g.room.paused||now<g.dealUntil)return false;
 const q=g.room.round;
 // Animations stay on the live table, never replaced by a full-screen poster.
 if(g.playMotion?.ends>now||g.drawMotions.some(m=>m.ends>now)||g.effects.some(e=>e.started+e.duration>now))return false;
 if(q.canEat&&!g.room.players[g.room.self].auto&&g.eatPromptDismissed!==[g.room.code||'practice',q.number,q.step].join(':')){eat(g);return true;}
 return false;
}
module.exports={drawReferenceMoment};
