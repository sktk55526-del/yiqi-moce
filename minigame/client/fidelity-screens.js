'use strict';
// Reference artwork supplies static decoration; all room state and actions stay live.
const { C } = require('./paint');
const VERSION = require('../shared/version');

function header(g, label) {
  const p=g.paint, y=Math.max(22,g.top+9);
  p.brand(85,y,234,76);
  p.icon('‹',12,g.top+4,()=>g.back());
  if(['join','room','settings'].includes(g.page))p.titleBadge(label,83,y+70,224,39);
  else p.sectionTitle(label,77,y+91,236,24);
  return y+119;
}

function viewport(g,y,h,content,draw) {
  const p=g.paint, max=Math.max(0,content-h), first=p.hits.length;
  g.rulesScroll=Math.max(0,Math.min(max,g.rulesScroll||0));
  p.ctx.save();p.shape(14,y,362,h,16);p.ctx.clip();
  draw(y-g.rulesScroll);
  p.ctx.restore();
  p.hits=p.hits.slice(0,first).concat(p.hits.slice(first).flatMap(hit=>{
    const a=Math.max(y,hit.y),b=Math.min(y+h,hit.y+hit.h);
    return b>a?[{...hit,y:a,h:b-a}]:[];
  }));
  g.scrollZone={x:14,y,w:362,h,type:'rules',max};
}

function home(g) {
  const image=g.images['ui-home-compact']; if(!image)return false;
  const p=g.paint, iw=image.width, ih=image.height;
  const ratio=iw/948, s=390/948, panelH=733*s;
  const y=g.height-g.bottom-panelH, heroH=y+4;
  const stretch=heroH/926;
  p.ctx.drawImage(image,0,0,iw,926*ratio,0,0,390,heroH);
  // Clean artwork contains no controls. Square live icons retain their shape
  // and full touch targets below the WeChat capsule on every aspect ratio.
  const iconY=g.top+4;
  p.icon('?',334,iconY,()=>g.open('rules'));
  p.icon('⚙',334,iconY+48,()=>g.open('settings'));
  p.ctx.drawImage(image,0,926*ratio,iw,ih-926*ratio,0,y,390,panelH);
  // The repaired wordmark keeps both brush tips and balanced transparent
  // margins. Fit its full image without trimming the first/last character.
  const subtitleY=367*stretch;
  const titleH=Math.min(116,Math.max(24,subtitleY-g.top-10));
  const titleY=subtitleY-titleH-8;
  if(!p.sprite('ui-home-wordmark',23,titleY,344,titleH))
    p.heading('一起抹车',195,titleY+titleH/2,54,C.cream,268);
  p.textBox('广东纸牌 · 好友同桌',100,subtitleY-11,190,22,14,C.cream,{weight:500});
  // Boxes follow the artwork's icon edge and inner right padding. Text uses the
  // same optical centre and font hierarchy across both columns, independent of
  // label length. Keep the decorative calligraphy confined to the brand mark.
  for(const [label,x0,y0,w,h,size,weight] of [
    ['创建好友房',213,1017,526,92,26,500],
    ['加入好友房',184,1201,239,70,18,500],['人机练习',641,1201,227,70,18,500],
    ['残局挑战',230,1353,191,66,16,500],['每日练习',642,1353,196,66,16,500],
    ['我的战绩',158,1557,155,54,14,500],['我的茶桌',448,1557,158,54,14,500],['新手教学',742,1557,160,54,14,500],
  ])p.textBox(label,x0*s,y+(y0-926)*s,w*s,h*s,size,y0<1300?C.light:C.ink,{weight});
  const items=[
    [88,982,780,164,()=>g.open('create')],
    [40,1175,425,123,()=>g.open('join')],[490,1175,420,123,()=>g.open('practice')],
    [76,1330,387,112,()=>g.openChallenges()],[491,1330,389,112,()=>g.startDaily()],
    [72,1538,247,98,()=>g.openRecords()],[349,1538,270,98,()=>g.openPartyPage('themes')],[657,1538,244,98,()=>g.startTutorial()],
  ];
  for(const [x0,y0,w,h,action] of items) {
    const x=x0*s,ty=y+(y0-926)*s;
    p.hit(x,ty,w*s,h*s,action);
    if(p.pressed && p.pressed.x>=x && p.pressed.x<=x+w*s && p.pressed.y>=ty && p.pressed.y<=ty+h*s)
      p.box(x+2,ty+2,w*s-4,h*s-4,19,'rgba(35,26,10,.12)');
  }
  if(g.online.session) p.button('返回牌局 ›',113,y-43,164,37,()=>g.online.reconnect(),'secondary');
  else if(g.lastParty?.match) p.button('上场战报 ›',113,y-43,164,37,()=>{g.partyRecord=g.lastParty;g.openPartyPage('matchBoard');},'secondary');
  return true;
}

function configure(g) {
  const p=g.paint, editing=g.page==='roomConfig', o=editing?g.roomDraft:g.options;
  const y=header(g,editing?'修改房间玩法':'创建好友房'), bottom=g.height-g.bottom;
  const height=bottom-y-81, rowH=Math.max(42,Math.min(78,(height-74)/7));
  p.panel(10,y,370,height);
  const rows=[
    ['桌位人数','players',[2,3,4,5,6],n=>n+'人'],
    ['牌副数','decks',[1,2,3,4],n=>n+'副'],
    ['牌堆用完','exhaustion',['shuffle','draw'],n=>n==='shuffle'?'洗牌继续':'直接流局'],
    ['好友整场赛','roundLimit',[0,8,16],n=>n?n+'局':'自由局'],
    ['出牌节奏','turnSeconds',[0,30,60],n=>n?n+'秒':'不限时'],
    ['候补观战','spectators',[true,false],n=>n?'开放':'关闭'],
  ];
  p.icon('⚙',334,g.top+4,()=>{g.overlay='offlineOptions';});
  viewport(g,y+14,height-29,rowH*7+9,origin=>{
    rows.forEach(([label,key,values,name],i)=>{
      const cy=origin+i*rowH+rowH/2, gap=5, start=126, w=(231-(values.length-1)*gap)/values.length;
      p.text(label,30,cy,18,C.ink,{align:'left',max:78});
      // Labels are left-aligned without forcing option text to share their column.
      p.line(115,cy-10,115,cy+10,'#B99453',.8);
      values.forEach((value,j)=>p.button(name(value),start+j*(w+gap),cy-17,w,34,
        editing && key==='players' && value<g.room.players.length?null:()=>{o[key]=value;},o[key]===value?'secondary':'paper'));
      p.line(27,origin+(i+1)*rowH,363,origin+(i+1)*rowH,'#CCB78D',.6);
    });
    const cy=origin+6*rowH+rowH/2;
    p.text('你的名称',30,cy,17,C.ink,{align:'left'});
    p.box(125,cy-18,152,36,18,p.gradient(cy-18,36,'#FFF6E1','#F2DDB7'),'#C49C59',.8);
    p.text((g.nameEditing?g.nameDraft:g.preferences.nickname)||'默认名称',139,cy,17,C.ink,{align:'left',max:123});
    if(!editing)p.button('修改',285,cy-18,70,36,!g.busy&&!g.nameEditing?()=>g.editNickname():null,'secondary');
  });
  p.button(editing?'保存玩法 · 重新准备':'创建房间',27,bottom-66,336,58,!g.busy&&!g.connecting?()=>editing?g.saveRoomOptions():g.enterOnline('create'):null);
  return true;
}

function join(g) {
  const p=g.paint, y=header(g,'加入好友房'), end=g.height-g.bottom;
  p.hit(83,y-49,224,39,()=>g.tapControlTitle(),{silent:true,controlEntry:true});
  const panelH=end-y, scale=Math.min(1.12,(panelH-28)/533), at=n=>y+12+n*scale;
  p.panel(8,y,374,panelH);
  p.text('输入好友分享的六位房间号',195,at(23),17,C.ink);
  for(let i=0;i<6;i++){
    const x=28+i*56;
    p.box(x+1,at(51)+3,49,64*scale,9,'#AF8D53');
    p.box(x,at(51),49,64*scale,9,p.gradient(at(51),64*scale,'#FFF1D2','#E9CF9A'),i===g.roomCode.length?'#AD7937':'#C6A15B',1.5);
    p.text(g.roomCode[i]||'·',x+24.5,at(82),39*scale,g.roomCode[i]?C.ink:'#A18E68',{family:'Georgia,serif'});
  }
  p.box(26,at(140),338,43*scale,21,'#F8EACB','#B99B60');
  p.text('你的名称',40,at(161),17,C.ink,{align:'left'});p.line(118,at(151),118,at(172),'#B89B63');
  p.text((g.nameEditing?g.nameDraft:g.preferences.nickname)||'默认名称',131,at(161),18,C.ink,{align:'left',max:151});
  p.text('修改',325,at(161),14,C.ink);
  p.hit(125,at(138),235,47*scale,!g.busy&&!g.connecting&&!g.nameEditing?()=>g.editNickname():null);
  const valid=g.roomCode.length===6&&!g.busy&&!g.connecting&&!g.nameEditing;
  p.button('加入牌桌',23,at(205),169,52*scale,valid?()=>g.enterOnline('join'):null,'secondary');
  p.button('观战 / 候补',202,at(205),166,52*scale,valid?()=>g.enterOnline('watch'):null,'paper');
  ['1','2','3','4','5','6','7','8','9','清空','0','⌫'].forEach((key,i)=>{
    const x=27+i%3*115,ky=at(286+Math.floor(i/3)*60);
    p.box(x+1,ky+3,106,49*scale,10,'#AD915F');
    p.box(x,ky,106,49*scale,10,p.gradient(ky,49*scale,'#FFF3DC','#F0D9AE'),'#B89759',1);
    p.heading(key,x+53,ky+24.5*scale,key.length===1?29:23,C.ink,94);
    p.hit(x,ky,106,49*scale,()=>g.inputCode(key));
  });
  return true;
}

function room(g) {
  const r=g.room;if(!r)return true;
  const p=g.paint,y=header(g,'好友房间'),end=g.height-g.bottom, {players,options,self,host,code}=r;
  p.icon('≡',334,g.top+4,()=>g.openPartyPage('party'));
  p.panel(8,y,374,end-y);
  p.text('房间号',40,y+36,20,C.ink,{align:'left'});
  p.text(code,220,y+36,35,C.ink,{family:'Georgia,serif'});
  p.icon('copy',327,y+13,()=>g.copyCode());
  p.chip(options.players+'人 · '+options.decks+'副牌 · '+(options.roundLimit?options.roundLimit+'局赛':'自由局'),195,y+66,280);
  const listY=y+111, available=end-listY-159;
  const gap=Math.max(56,Math.min(85,available/options.players));
  viewport(g,listY,available,gap*options.players,origin=>{
  for(let i=0;i<options.players;i++){
    const item=players[i],row=origin+i*gap,radius=Math.min(27,(gap-13)/2);
    p.box(23,row,344,gap-8,15,p.gradient(row,gap,'#FFF3DB','#EFDDB5'),'#D1B784');
    p.avatar(item?g.images['avatar'+item.avatar]:null,59,row+(gap-8)/2,radius,item?'茶':'＋');
    p.text(item?item.name+(i===self?'（你）':''):'空位',98,row+(gap-8)/2,19,C.ink,{align:'left',max:147});
    const status=!item?'等待加入':!item.online?'离线':i===host?'房主':item.ready?'已准备':'未准备';
    p.box(254,row+(gap-8)/2-13,100,26,13,item?.ready?C.jade:i===host?'#B5512A':'#EDDCB7',C.gold,.7);
    p.text(status,304,row+(gap-8)/2,13,item?.ready||i===host?C.light:C.ink);
    if(item&&self===host&&i!==self&&!g.busy)p.hit(23,row,344,gap-8,()=>g.manage(i));
  }
  });
  const note=end-135;
  p.text(options.exhaustion==='shuffle'?'牌堆用完洗牌继续':'牌堆用完流局不计分',195,note,14,C.ink);
  if(self===host&&!g.busy){p.text('提醒好友准备',195,note+24,12,C.ink);p.hit(100,note+8,190,32,()=>{g.send('remind');g.toast('已提醒未准备的玩家');});}
  const mayStart=players.length>=2&&players.every((item,i)=>item.online&&(i===host||item.ready));
  p.button('邀请好友',25,end-95,161,49,()=>g.share(),'paper');
  p.button(self===host?'开始游戏':players[self]?.ready?'取消准备':'准备',198,end-95,167,49,
    self===host?(mayStart&&!g.busy?()=>g.send('start'):null):!g.busy?()=>g.send('ready',{ready:!players[self].ready}):null,'secondary');
  const edit=self===host&&r.features?.includes('room-options');
  p.text(edit?'修改玩法 ›':'房间设置由房主修改',195,end-23,16,C.ink);
  if(edit&&!g.busy)p.hit(105,end-40,180,34,()=>g.editRoomOptions());
  return true;
}

function settings(g){
  const p=g.paint,y=header(g,'设置'),end=g.height-g.bottom,h=end-y;
  if(g.platform.appInfo)p.button('关于',326,g.top+4,52,36,()=>g.platform.appInfo(),'paper');
  p.panel(9,y,372,h);
  const rowH=49;
  const by=end-(g.room?85:72);
  viewport(g,y+12,by-y-24,407,origin=>{
  const entries=[['music','背景音乐','♫'],['sound','音效','♪'],['vibration','震动','◇'],['reducedMotion','减少动态效果','✦'],['reactions','接收表情与短句','☻']];
  entries.forEach(([key,label,icon],i)=>{
    const cy=origin+24+i*rowH;
    p.text(icon,48,cy,26,C.jade);p.text(label,76,cy,20,C.ink,{align:'left',max:213});
    p.toggle(g.preferences[key],298,cy-15,()=>g.toggle(key));
    p.hit(33,cy-19,251,38,()=>g.toggle(key));
    p.line(31,cy+rowH/2,359,cy+rowH/2,'#CCB78D',.7);
  });
  let cy=origin+24+5*rowH;
  p.text('语音语言',35,cy,17,C.ink,{align:'left'});
  p.button('香港粤语',133,cy-18,91,36,()=>g.setVoice('yue'),g.preferences.voice==='yue'?'secondary':'paper');
  p.button('普通话',233,cy-18,119,36,()=>g.setVoice('mandarin'),g.preferences.voice!=='yue'?'secondary':'paper');
  cy+=47;
  p.button('我的茶桌  ›',30,cy,330,43,()=>g.openPartyPage('themes'),'paper');
  p.button('音乐署名  ›',30,cy+53,330,43,()=>g.copyMusicCredits(),'paper');
  });
  p.button(g.room?'返回牌桌':'返回',104,by,182,49,()=>g.back(),'secondary');
  if(g.room){p.text('退出房间',195,end-20,14,C.red);p.hit(130,end-36,130,30,()=>{g.overlay='leave';});}
  else p.text('版本 '+(g.platform.appVersion||VERSION),195,end-12,9,'#8B7958');
  return true;
}

const pages={home,create:configure,roomConfig:configure,join,room,settings};
function drawFidelity(g){
  if(g.page==='home')return home(g);
  if(!g.platform.uiImage)return false;
  return pages[g.page]?.(g)||false;
}
module.exports={drawFidelity,home,configure,join,room,settings};
