'use strict';
const {suitName}=require('./voice');
// Reference-matched jade, camellia, gold and progressively warmer penalty badges.
const REPORT={type:'report',sound:'report',duration:1100};
const MISSED_REPORT={type:'missed-report',sound:'missed-report',duration:1450};
const EAT={type:'eat',sound:'eat',duration:1250};
const PENALTIES=[
 {duration:850,color:'#FFE6A2',accent:'#DAA83D',reach:50,shake:1.4},
 {duration:1000,color:'#FFE4A0',accent:'#FF9B2D',reach:65,shake:2.2},
 {duration:1150,color:'#FFE9AC',accent:'#FF6D28',reach:82,shake:3.1},
 {duration:1350,color:'#FFF0B7',accent:'#FF4A20',reach:101,shake:4.2}
];
// Coordinates in the 1254px transparent production atlas.
const ATLAS={
 eat:[0,70,626,350],report:[628,70,626,350],missed:[46,470,1162,300],
 'penalty-2':[0,835,276,310],'penalty-4':[276,835,284,310],
 'penalty-6':[560,835,308,310],'penalty-8':[868,812,386,350]
};
const clamp=n=>Math.max(0,Math.min(1,n));
function effectEnvelope(t){
 const enter=clamp(t/.19),out=clamp((1-t)/.23);
 return {alpha:Math.min(1,enter*2,out),scale:.72+.28*(1-(1-enter)**3)+.055*Math.sin(enter*Math.PI)};
}
function playEffect(event){
 if(event.type==='eat')return EAT;
 if(event.type==='play'&&event.card.rank===8&&['club','heart','diamond','spade'].includes(event.suit))
  return {type:'suit',suit:event.suit,sound:'suit-'+event.suit,duration:1200};
 if(event.type!=='play'||event.card.rank!==2)return null;
 const count=event.penalty,tier=Math.min(3,Math.max(0,Math.floor(count/2)-1));
 return {...PENALTIES[tier],sound:'penalty-'+count,type:'penalty',count,tier};
}
function atlasSprite(p,key,x,y,width){
 const image=p.assets?.['ui-action-fx-atlas'],rect=ATLAS[key];
 if(!image||!rect)return false;
 const [sx,sy,sw,sh]=rect,h=width*sh/sw,factor=image.width/1254;
 p.ctx.drawImage(image,sx*factor,sy*factor,sw*factor,sh*factor,x-width/2,y-h/2,width,h);
 return true;
}
function sparkle(p,x,y,t,reach,count,color='#FFE9AC'){
 const g=p.ctx;g.save();g.globalAlpha*=Math.sin(Math.PI*t)*.78;
 for(let i=0;i<count;i++){
  const a=i*2.39996,r=reach*(.45+.55*t)*(i%3===0?1:.8),xx=x+Math.cos(a)*r,yy=y+Math.sin(a)*r*.65;
  const size=(i%3===0?3:1.5)*(1-t*.5);
  p.line(xx-size,yy,xx+size,yy,color,1.15);p.line(xx,yy-size,xx,yy+size,color,1.15);
 }g.restore();
}
function orbit(p,x,y,r,t,alpha=1){
 const g=p.ctx;g.save();g.translate(x,y);g.rotate(-.2);g.scale(1,.31);
 g.globalAlpha*=alpha;g.strokeStyle='#FFDB76';g.lineWidth=2;g.shadowColor='#FF9B2D';g.shadowBlur=7;
 g.beginPath();g.arc(0,0,r,t*Math.PI*2,t*Math.PI*2+Math.PI*1.3);g.stroke();g.restore();
}
function quatrefoil(g,x,y,size){
 const r=size/2;g.beginPath();g.moveTo(x,y-r);
 g.bezierCurveTo(x+r*.42,y-r*1.12,x+r*.53,y-r*.72,x+r*.51,y-r*.51);
 g.bezierCurveTo(x+r*1.16,y-r*.57,x+r*1.16,y+r*.57,x+r*.51,y+r*.51);
 g.bezierCurveTo(x+r*.57,y+r*1.16,x-r*.57,y+r*1.16,x-r*.51,y+r*.51);
 g.bezierCurveTo(x-r*1.16,y+r*.57,x-r*1.16,y-r*.57,x-r*.51,y-r*.51);
 g.bezierCurveTo(x-r*.53,y-r*.72,x-r*.42,y-r*1.12,x,y-r);g.closePath();
}
function penaltyFallback(p,count,tier){
 const g=p.ctx;quatrefoil(g,0,0,94+tier*11);g.fillStyle=tier?'#A52A10':'#775521';g.fill();
 g.strokeStyle='#FFE6A4';g.lineWidth=2.4;g.stroke();
 p.text('+'+count,0,2,count>=10?49:60,'#FFEAB5',{family:'Georgia,serif',weight:700,exactSize:true,max:130});
}
function drawCenterEffect(p,active,x,y){
 if(!active)return;const {effect,progress:t}=active;
 if(effect.type==='penalty'){
  const g=p.ctx;g.save();g.globalAlpha*=effectEnvelope(t).alpha;
  sparkle(p,x,y,t,effect.reach,7+effect.tier*5);
  if(effect.tier>=2)orbit(p,x,y,effect.reach*.85,t,.55);
  g.restore();
 }
}
function drawPenaltyStamp(p,active,x,y){
 if(active?.effect.type!=='penalty')return;
 const {effect,progress:t}=active,{scale,alpha}=effectEnvelope(t),g=p.ctx,width=[112,146,184,226][effect.tier];
 x=Math.max(width/2+5,Math.min(385-width/2,x));
 g.save();g.translate(x,y);g.scale(scale,scale);g.globalAlpha*=alpha;
 if(!atlasSprite(p,'penalty-'+effect.count,0,0,width))penaltyFallback(p,effect.count,effect.tier);
 g.restore();
}
function drawEat(p,x,y,t){
 const {alpha,scale}=effectEnvelope(t),g=p.ctx;g.save();g.translate(x,y);g.scale(scale,scale);g.globalAlpha*=alpha;
 sparkle(p,0,0,t,145,17);
 if(!atlasSprite(p,'eat',0,0,306))p.heading('吃',0,0,90,'#FFE3A0',130);g.restore();
}
function drawReport(p,x,y,t){
 const {alpha,scale}=effectEnvelope(t),g=p.ctx,width=176;x=Math.max(92,Math.min(298,x));y=Math.max(81,y-49);
 g.save();g.globalAlpha*=alpha;g.translate(x,y);g.scale(scale,scale);sparkle(p,0,0,t,83,8);
 if(!atlasSprite(p,'report',0,0,width)){
  quatrefoil(g,0,0,68);g.fillStyle='#104638';g.fill();g.strokeStyle='#EEC573';g.lineWidth=2;g.stroke();p.heading('报',0,0,46,'#FFE7AE');
 }g.restore();
}
function drawMissedReport(p,x,y,t){
 const {alpha,scale}=effectEnvelope(t),g=p.ctx;g.save();g.translate(195,Math.max(88,y));g.scale(scale,scale);g.globalAlpha*=alpha;
 if(!atlasSprite(p,'missed',0,0,338)){
  p.box(-153,-25,306,50,15,'#861F0C','#FFC65B',2);p.text('⚠ 漏报，罚摸1张！',0,0,21,'#FFEAC0',{max:285});
 }g.restore();
}
function drawSuitAnnouncement(p,active,x,y){
 if(active?.effect.type!=='suit')return;
 const {effect:{suit},progress:t}=active,{alpha,scale}=effectEnvelope(t),g=p.ctx;
 const name=suitName(suit,p.appearance?.voice);if(!name)return;
 const ink=['heart','diamond'].includes(suit)?'#B42217':'#172A20';
 g.save();g.translate(x,y);g.scale(scale,scale);g.globalAlpha*=alpha;
 quatrefoil(g,0,0,78);g.fillStyle='#FFF1D1';g.shadowColor='#E3A94A';g.shadowBlur=7;g.fill();
 g.shadowBlur=0;g.strokeStyle='#E5B562';g.lineWidth=2.4;g.stroke();
 p.text(name,0,-13,19,ink,{exactSize:true,weight:600});p.suit(suit,0,15,24,ink);g.restore();
}
function activeEffects(effects,now){
 return effects.flatMap(effect=>{const progress=(now-effect.started)/effect.duration;return progress>=0&&progress<1?[{effect,progress}]:[];});
}
module.exports={REPORT,MISSED_REPORT,playEffect,activeEffects,drawCenterEffect,drawPenaltyStamp,drawReport,drawMissedReport,drawEat,drawSuitAnnouncement,atlasSprite,effectEnvelope,ATLAS};
