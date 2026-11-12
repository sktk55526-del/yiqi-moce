'use strict';
const {C}=require('./paint');
const {SUITS}=require('../shared/rules');
const {suitName}=require('./voice');
const {REACTIONS}=require('../shared/social');
const {plaque,row,scenic}=require('./reference-pages');
function dim(g){g.paint.hits=[];g.paint.box(0,0,390,g.height,0,'rgba(1,20,15,.72)');}
function modal(g,h,title){const p=g.paint,y=Math.max(g.top+30,(g.height-h)/2);p.panel(14,y,362,h);p.titleBadge(title,45,y+18,300,43,title.startsWith('朋友投票'));return y;}
function suit(g){
  const p=g.paint,y=modal(g,460,'选择花色');p.text('出 8 后，下一位按所选花色接牌',195,y+84,13,C.ink);
  SUITS.forEach((s,i)=>{const x=49+i%2*151,cy=y+106+Math.floor(i/2)*119;row(p,x,cy,140,109,g.suit===s);p.suit(s,x+70,cy+39,49,s==='heart'||s==='diamond'?C.red:C.ink);p.heading(suitName(s,g.preferences.voice),x+70,cy+85,23,C.ink);p.hit(x,cy,140,109,()=>{g.suit=s;});});
  p.button(g.suit?'确认'+suitName(g.suit,g.preferences.voice):'请选择花色',52,y+361,286,46,g.suit&&!g.busy?()=>g.confirmSuit():null,'secondary');p.text(g.suit?'将播报：'+suitName(g.suit,g.preferences.voice):'选择后会播报花色名称',195,y+430,12,'#846B41');p.icon('×',324,y-24,()=>{g.overlay=null;});
}
function vote(g){const p=g.paint,v=g.room?.vote,confirm=g.overlay==='confirmVote',kind=confirm?g.pendingVote:v.kind,y=Math.max(g.top+30,g.height-g.bottom-379);
  p.panel(14,y,362,379);p.titleBadge(kind==='pause'?'朋友投票暂停':'朋友投票散桌',45,y+18,300,43,true);
  p.text('全体在线玩家同意后执行',195,y+83,13,C.ink);
  const eligible=confirm?g.room.players.filter(a=>a.online):v.eligible.map(id=>g.room.players.find(a=>a.id===id)).filter(Boolean),n=eligible.length;
  eligible.forEach((a,i)=>{const x=43+(i+.5)*304/Math.max(1,n),cy=y+129;p.avatar(g.images['avatar'+a.avatar],x,cy,Math.min(23,130/Math.max(1,n)),a.name.slice(-1));p.text(a.name,x,cy+34,12,C.ink,{max:304/n-3});p.text(confirm?'待发起':v.yes.includes(a.id)?'✓ 已同意':v.no.includes(a.id)?'不同意':'等待中',x,cy+57,10,C.ink,{max:304/n-3});});
  const sec=confirm?'?':Math.max(0,Math.ceil((v.expires-Date.now()-(g.serverOffset||0))/1000));p.circle(195,y+239,24,C.light,C.gold,2);p.heading(sec+'秒',195,y+239,19,C.ink);
  p.button(confirm?'取消':'不同意',36,y+281,150,45,()=>{if(confirm)g.overlay=null;else if(!g.busy)g.send('vote',{voteId:v.id,agree:false});},'paper');p.button(confirm?'发起投票':kind==='pause'?'同意暂停':'同意散桌',201,y+281,153,45,!g.busy?()=>{g.send('vote',confirm?{kind}: {voteId:v.id,agree:true});g.overlay=null;}:null);
  p.text(kind==='pause'?'暂停最长 2 分钟，可由房主提前恢复':'未完成本局不计分，已完成积分保留',195,y+350,12,C.ink);
}
function social(g){const p=g.paint,b=g.height-g.bottom,h=404,y=Math.max(g.top+35,b-h);const hero=g.images['ui-home-reference'];if(hero)p.ctx.drawImage(hero,0,0,hero.width,hero.height*.558,0,0,390,y+10);p.panel(7,y,376,b-y);p.icon('×',329,y-41,()=>{g.overlay=null;});
  p.button('香港粤语',24,y+16,83,35,()=>g.setVoice('yue'),g.preferences.voice==='yue'?'secondary':'paper');p.button('普通话',112,y+16,83,35,()=>g.setVoice('mandarin'),g.preferences.voice!=='yue'?'secondary':'paper');p.button(g.preferences.reactions?'静音互动':'开启互动',211,y+16,154,35,()=>g.toggle('reactions'),'paper');
  p.button('表情',24,y+63,168,40,()=>{g.socialTab='expression';},g.socialTab!=='voice'?'secondary':'paper');p.button('语音',199,y+63,166,40,()=>{g.socialTab='voice';},g.socialTab==='voice'?'secondary':'paper');
  REACTIONS.forEach((r,i)=>{const x=22+i%3*117,cy=y+119+Math.floor(i/3)*130;row(p,x,cy,111,121);if(!p.sprite('ui-reaction-'+i,x+7,cy+7,97,67))p.heading(r.icon,x+55,cy+43,35,C.ink);plaque(p,g.preferences.voice==='yue'?r.text:r.mandarin,x+4,cy+81,103,31);p.hit(x,cy,111,121,()=>g.sendReaction(r.id));});
}
function reconnect(g){const p=g.paint,y=Math.max(g.top+30,(g.height-302)/2);p.panel(30,y,330,302);p.sprite('ui-tea-cup',132,y+19,126,67);p.heading('正在恢复牌桌…',195,y+115,27,C.ink,306);p.text(g.online.session?'原座位、手牌和积分已保留':'正在连接好友房，请稍候',195,y+154,16,C.ink,{max:290});p.text(String(g.connecting||'网络恢复后自动重连'),195,y+185,12,C.ink,{max:289});p.button('返回大厅',58,y+225,274,44,()=>g.cancelConnection(),'paper');}
function returned(g){
 const p=g.paint,r=g.room,q=r.round,b=g.height-g.bottom,py=b-220,scene=g.images['ui-salon-background'];
 if(scene)p.ctx.drawImage(scene,0,0,390,py/.55);else p.box(0,0,390,g.height,0,C.pine);
 p.brand(113,g.top-6,164,58);plaque(p,'房间号 '+r.code,120,g.top+57,150,25);
 p.heading('已返回原座位',195,g.top+105,30,C.cream);p.box(92,g.top+132,206,31,8,'#A64129',C.gold,1);p.heading('本局由电脑代打',195,g.top+148,19);
 p.text('手牌与积分保留，下一局恢复操作',195,g.top+183,13,C.cream);
 r.players.filter((a,i)=>i!==r.self).slice(0,3).forEach((a,i)=>{const x=[52,195,338][i],y=g.top+232+(i===1?-15:0);p.avatar(g.images['avatar'+a.avatar],x,y,20,a.name.slice(-1));plaque(p,a.name,x-38,y+22,76,23,'paper');});
 const cards=q.hand.slice(0,7),gap=Math.min(46,284/Math.max(1,cards.length)),x=(390-(cards.length-1)*gap-55)/2,hy=Math.max(g.top+280,py-104);
 cards.forEach((c,i)=>p.card(c,x+i*gap,hy,55,77));
 p.panel(9,py,372,220);p.titleBadge('等待下一局接回',39,py+16,312,43);p.text('当前积分 '+q.scores[r.self]+' · 手牌 '+q.hand.length+' 张',195,py+82,16,C.ink);
 p.text('本局由电脑继续，下局恢复操作',195,py+110,13,C.ink);
 p.button('查看当前牌局',48,b-67,294,46,()=>{g.returnViewed=q.number;},'secondary');
}

function appearance(g){const p=g.paint,y=modal(g,280,'牌背图案');[['flower','茶花'],['diamond','菱纹'],['tea','茶字']].forEach(([id,label],i)=>{p.button(label,33+i*111,y+100,102,47,()=>g.setAppearance('cardBack',id),g.preferences.cardBack===id?'secondary':'paper');});p.button('完成',51,y+199,288,46,()=>{g.overlay=null;},'secondary');}
function drawReferenceOverlay(g){
  if(!g.platform.uiImage)return false;
  const v=g.room?.vote,mustVote=v&&v.eligible.includes(v.mine)&&!v.yes.includes(v.mine)&&!v.no.includes(v.mine);
  const resume=g.page==='table'&&!g.room?.round?.result&&g.room?.players[g.room.self]?.returnNextRound&&g.returnViewed!==g.room.round.number;
  const handled=['suit','social','confirmVote','appearance','offlineOptions'].includes(g.overlay)||(!g.overlay&&(g.connecting||mustVote||resume));
  if(!handled)return false;dim(g);
  if(g.overlay==='offlineOptions'){const p=g.paint,y=modal(g,270,'断线托管'),o=g.page==='roomConfig'?g.roomDraft:g.options;
    p.text('好友断线后的处理方式',195,y+92,16,C.ink);
    p.button('30秒后代打',34,y+124,157,42,()=>{o.offlineAuto=true;},o.offlineAuto?'secondary':'paper');
    p.button('等待本人',201,y+124,157,42,()=>{o.offlineAuto=false;},!o.offlineAuto?'secondary':'paper');
    p.button('完成',58,y+201,274,45,()=>{g.overlay=null;},'secondary');
  }else if(g.overlay==='suit')suit(g);else if(g.overlay==='social')social(g);else if(g.overlay==='appearance')appearance(g);else if(g.overlay==='confirmVote'||mustVote)vote(g);else if(g.connecting)reconnect(g);else returned(g);return true;
}
module.exports={drawReferenceOverlay};
