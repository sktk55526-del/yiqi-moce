'use strict';
const {C,ranks,symbols}=require('./paint');
const {THEMES,themeOf}=require('./themes');
const {recordStats}=require('./records');
const {describeEvent}=require('./feature-screens');
const {puzzles,dayKey}=require('../shared/challenges');
const {SUITS,SUIT_NAMES}=require('../shared/rules');
const {REACTIONS}=require('../shared/social');
const {lessons}=require('./tutorial');
const {DIFFICULTIES}=require('../shared/strategy');
const copy=require('./copy');
const fmt=n=>n>0?'+'+n:String(n??0);
const end=g=>g.height-g.bottom;
const ink='#173D32',muted='#78684B';

function plaque(p,label,x,y,w,h=39,variant='secondary'){
  const dark=variant==='secondary',gold=variant==='primary';
  if(gold&&h>=33){p.titleBadge(label,x,y,w,h);return;}
  p.box(x,y+2,w,h,h/2,'rgba(28,30,15,.22)');
  p.box(x,y,w,h,h/2,p.gradient(y,h,gold?'#D5A34D':dark?'#17614C':'#FFF2D5',gold?'#AA702B':dark?'#083E32':'#EDD3A3'),C.gold,1.1);
  p.box(x+2,y+2,w-4,h-4,h/2-2,null,gold?'#FFE0A2':dark?'#BB9D5A':'#FFF9E9',.6);
  p.heading(label,x+w/2,y+h/2,h>44?24:18,dark||gold?C.light:ink,w-18);
}
function header(g,label,detail='',brand=true){
  const p=g.paint,top=g.top;
  if(brand){
    p.brand(98,top+5,194,61);
    if(['scoreDetail','themes','tutorial','challenges','closed','awards'].includes(g.page))p.titleBadge(label,78,top+65,234,39,['tutorial','awards'].includes(g.page));
    else p.sectionTitle(label,65,top+86,260,23);
  }else {
    const title={result:'result',matchBoard:'match',records:'records'}[g.page];
    if(!title||!p.sprite('ui-title-'+title,99,top+26,192,49))p.heading(label,195,top+47,35,C.cream,310);
  }
  p.icon('‹',14,top+3,()=>g.back());
  const y=top+(brand?114:96);
  if(detail)p.text(detail,195,y-3,12,brand?C.cream:C.gold,{max:345});
  return y+(detail?15:0);
}
function scroll(g,y,h,total,draw){
  const p=g.paint,first=p.hits.length,max=Math.max(0,total-h);
  g.rulesScroll=Math.max(0,Math.min(max,g.rulesScroll||0));
  p.ctx.save();p.shape(19,y,352,h,10);p.ctx.clip();draw(y-g.rulesScroll);p.ctx.restore();
  p.hits=p.hits.slice(0,first).concat(p.hits.slice(first).flatMap(a=>{
    const top=Math.max(y,a.y),bottom=Math.min(y+h,a.y+a.h);
    return bottom>top?[{...a,y:top,h:bottom-top}]:[];
  }));g.scrollZone={x:19,y,w:352,h,type:'rules',max};
}
function row(p,x,y,w,h=47,active=false){p.box(x,y,w,h,13,p.gradient(y,h,active?'#F9D98E':'#FFF2D5',active?'#E9BF6E':'#EFDEB9'),active?'#B98B3B':'#CAB17C',1);}
function tabs(g,items,x,y,w=342,h=37){const p=g.paint,gap=5,bw=(w-gap*(items.length-1))/items.length;items.forEach(([label,active,action],i)=>p.button(label,x+i*(bw+gap),y,bw,h,action,active?'secondary':'paper'));}
function scenic(g,y,h){
  const p=g.paint,im=g.images['ui-salon-background']||g.images['ui-scene-reference'];
  p.ctx.save();p.shape(16,y,358,h,17);p.ctx.clip();
  if(im)p.cover(im,16,y,358,h,.28);else p.box(16,y,358,h,17,C.jade);
  p.ctx.restore();p.box(16,y,358,h,17,null,'#B59553',.8);
}
function empty(g,y,label='还没有对局记录',note='和好友打一局，留下第一份战绩',action){
  const p=g.paint,h=Math.min(320,end(g)-y-20);p.panel(15,y,360,h);
  p.sprite('ui-tea-cup',83,y+24,224,118);p.heading(label,195,y+167,24,ink,325);
  p.text(note,195,y+207,13,muted,{max:322});
  p.button(action?.[0]||'返回',62,y+h-64,266,46,action?.[1]||(()=>g.back()),'secondary');
}
function records(g){
  const p=g.paint,y=header(g,'我的战绩','本机最近 20 局',false),b=end(g),mode=g.recordMode==='all'?null:g.recordMode;
  const stats=recordStats(g.records,mode),rows=g.records.filter(r=>!mode||r.mode===mode);
  p.panel(9,y,372,b-y-67);
  tabs(g,[['全部',!mode,()=>{g.recordMode='all';g.rulesScroll=0;}],['好友房',mode==='friends',()=>{g.recordMode='friends';g.rulesScroll=0;}],['人机练习',mode==='practice',()=>{g.recordMode='practice';g.rulesScroll=0;}]],25,y+15);
  let streak=0,bestStreak=0;for(const r of [...rows].reverse()){streak=r.result.winner===r.self?streak+1:0;bestStreak=Math.max(bestStreak,streak);}
  [['最近20局',stats.played],['获胜',stats.wins],['最佳连胜',bestStreak]].forEach(([label,n],i)=>{const x=29+i*112;row(p,x,y+69,105,76);p.heading(n,x+52,y+97,26,ink);p.text(label,x+52,y+126,13,muted);});
  p.text('对局记录',32,y+170,17,ink,{align:'left'});
  if(g.records.length){p.text('清空',336,y+170,12,muted);p.hit(307,y+151,55,38,()=>{g.overlay='clearRecords';});}
  const sy=y+191,sh=b-sy-88;
  scroll(g,sy,sh,Math.max(120,rows.length*79),origin=>{
    if(!rows.length){p.sprite('ui-tea-cup',135,origin+4,120,65);p.text('还没有完成的对局',195,origin+92,16,muted);}
    rows.forEach((r,i)=>{const ry=origin+i*79;row(p,26,ry,338,70);
      p.avatar(g.images['avatar'+(r.players[r.self].avatar||0)],51,ry+34,17,'茶');
      const d=new Date(r.savedAt);p.text((d.getMonth()+1)+'月'+d.getDate()+'日',80,ry+22,15,ink,{align:'left'});
      p.text((r.mode==='friends'?'好友房':'人机练习')+' · '+r.players.length+'人',80,ry+47,11,muted,{align:'left'});
      p.heading(fmt(r.result.deltas[r.self]),233,ry+34,23,r.result.deltas[r.self]>0?C.red:ink,66);
      p.button('查看回顾',278,ry+17,76,36,()=>g.openReplay(r),'secondary');
    });
  });p.button('返回首页',45,b-57,300,47,()=>g.back());return true;
}
function result(g){
  const r=g.room;if(!r?.round)return true;const p=g.paint,q=r.round,res=g.page==='result'?q.result:null;
  const y=header(g,res?'本局结算':'累计积分','第 '+q.number+' 局',false),b=end(g);
  const py=y+102;p.panel(9,py,372,b-py-6);
  if(res){
    if(!p.sprite('ui-winner-trophy',71,y-15,248,155))p.trophy(195,y+24,49);
    p.heading(res.winner===null?'本局流局':r.players[res.winner].name+' 获胜',195,y+96,25,C.cream,181);
  }else plaque(p,'好友同桌 · 多局累计',75,y+52,240,38,'primary');
  row(p,27,py+17,336,30);['玩家','本局','累计'].forEach((s,i)=>p.text(s,[100,239,319][i],py+32,14,ink));
  const footer=b-153,bodyY=py+57,bodyH=Math.max(100,footer-bodyY);
  scroll(g,bodyY,bodyH,r.players.length*57,origin=>r.players.forEach((a,i)=>{
    const ry=origin+i*57;row(p,25,ry,340,50,res?.winner===i);p.avatar(g.images['avatar'+a.avatar],51,ry+25,20,a.name.slice(-1));
    p.text(i===r.self?'你':a.name,83,ry+18,18,ink,{align:'left',max:120});
    p.text(a.nextReady?'已准备':res&&r.code?'待准备':'第'+q.number+'局',83,ry+38,10,muted,{align:'left'});
    p.heading(res?fmt(res.deltas[i]):'—',240,ry+25,22,res?.deltas[i]>0?C.red:ink,67);p.heading(fmt(q.scores[i]),321,ry+25,21,ink,66);
    if(res?.details)p.hit(25,ry,340,50,()=>g.scoreDetail(i));
  }));
  const noteY=b-139;row(p,26,noteY,338,48);
  p.text(res?'点玩家查看余牌与算分明细':'分数按本房间累计',195,noteY+15,12,muted);
  p.text(res?'下一局由 '+r.players[res.nextStarter].name+' 先出':'整场排名 / 趣味称号 ›',195,noteY+34,15,ink);
  if(!res&&r.match)p.hit(26,noteY,338,48,()=>g.openPartyPage('matchBoard'));
  if(res){p.button('本局回顾',24,b-72,151,49,q.history?.length?()=>g.openReplay():null,'paper');
    const label=!r.code?'再来一局':r.players[r.self].nextReady?'已准备':'准备下一局';
    p.button(label,184,b-72,182,49,!g.busy&&(!r.code||!r.players[r.self].nextReady)?()=>g.next():null);
  }else p.button('返回牌桌',43,b-72,304,49,()=>g.back(),'secondary');return true;
}
function detail(g){
  const p=g.paint,s=g.detailRecord?{round:g.detailRecord,players:g.detailRecord.players}:g.room;
  if(!s)return true;const {round:q,players}=s,i=g.detailSeat,r=q.result,d=r?.details?.[i];if(!d)return true;
  const y=header(g,'计分明细'),b=end(g);p.panel(9,y,372,b-y);
  p.avatar(g.images['avatar'+players[i].avatar],70,y+40,24,'茶');plaque(p,players[i].name,108,y+23,161,35);
  const bodyY=y+81,bodyH=b-y-166,cardRows=Math.ceil(d.cards.length/4);
  scroll(g,bodyY,bodyH,Math.max(312,cardRows*99+235),origin=>{
    plaque(p,'剩余手牌',125,origin,140,28,'paper');
    d.cards.forEach((c,n)=>p.card(c,38+n%4*80,origin+41+Math.floor(n/4)*99,70,94));
    let ry=origin+41+cardRows*99+12;
    if(r.winner===i){p.wrap('其他玩家全部扣分相加，计为本局得分。',40,ry,310,17,ink,27);ry+=65;}
    else {row(p,29,ry,332,38);p.text('基础分',67,ry+19,13,ink);p.text(d.values.join(' + ')+' = '+d.base,218,ry+19,17,ink,{max:230});ry+=49;
      row(p,29,ry,332,38);p.text(d.doubles+' 张 2',74,ry+19,14,ink);p.heading('× '+d.multiplier,231,ry+19,24,ink);ry+=57;}
    plaque(p,(r.winner===i?'本局得分：':'本局扣分：')+Math.abs(r.deltas[i]),33,ry,324,52,'primary');
    p.text(r.winner===null?'流局实际不加不扣分':'8 计 20 分，每张 2 使总分翻倍',195,ry+79,12,muted);
  });
  p.button('‹',24,b-62,57,44,()=>{g.detailSeat=(i+players.length-1)%players.length;g.rulesScroll=0;},'paper');
  p.button('返回结算',91,b-62,208,44,()=>g.back(),'secondary');
  p.button('›',309,b-62,57,44,()=>{g.detailSeat=(i+1)%players.length;g.rulesScroll=0;},'paper');return true;
}
function match(g){
  const p=g.paint,r=g.partyRecord||g.room,m=r?.match,y=header(g,'好友整场赛',m?'已完成 '+m.completed+' / '+(m.limit||'自由')+' 局':'',false),b=end(g);
  if(!m){empty(g,y,'还没有整场战绩','好友房完成对局后显示排名');return true;}
  const ranked=[...m.ledger].sort((a,b)=>b.points-a.points),rounds=(g.matchTab==='rounds'?m.rounds:m.rounds.slice(-5));p.panel(9,y,372,b-y-4);
  const total=ranked.length*45+100+rounds.length*29;
  scroll(g,y+14,b-y-145,total,origin=>{
    p.text('名次       玩家         累计积分     胜局',195,origin+12,12,muted);
    ranked.forEach((a,i)=>{const ry=origin+32+i*45;row(p,26,ry,338,40,i===0);p.circle(47,ry+20,13,i===0?'#D2A241':'#D5C7A5');p.text(ranked.findIndex(n=>n.points===a.points)+1,47,ry+20,16,C.light);p.text(a.name,76,ry+20,18,ink,{align:'left',max:124});p.heading(fmt(a.points),260,ry+20,23,a.points>0?C.red:ink,75);p.text(a.wins+'胜',335,ry+20,13,ink);});
    const ty=origin+ranked.length*45+43;
    tabs(g,[['本场排行',g.matchTab!=='rounds',()=>{g.matchTab='rank';}],['逐局记录',g.matchTab==='rounds',()=>{g.matchTab='rounds';}]],26,ty,338,33);
    p.text('局数             本局赢家             领先玩家',195,ty+50,12,muted);
    rounds.forEach((a,i)=>{const ry=ty+65+i*29,leader=[...a.points].sort((a,b)=>b.points-a.points)[0];p.text('第 '+a.number+' 局',57,ry,13,ink);p.text(a.winner,165,ry,15,ink,{max:102});p.text(leader?leader.name+' '+fmt(leader.points):'—',296,ry,13,ink,{max:125});p.line(30,ry+13,360,ry+13,'#D7C29A',.5);});
  });
  p.button('趣味称号',26,b-117,164,42,()=>g.openPartyPage('awards'),'paper');p.button('名场面战报',201,b-117,163,42,()=>g.openPartyPage('warReport'),'paper');
  p.button('返回牌桌',43,b-64,304,46,()=>r.ended&&!g.partyRecord?g.leave():g.back(),'secondary');return true;
}

function report(g){
  const p=g.paint,r=g.partyRecord||g.room,m=r?.match,y=header(g,'一起抹车 · 茶馆战报',m?'好友 '+(m.limit||'自由')+' 局赛 · '+m.ledger.length+'人同桌':'',false),b=end(g);
  if(!m){empty(g,y,'今晚的好戏还未开场','完成好友房牌局后自动生成战报');return true;}
  scenic(g,y,107);plaque(p,'今晚最佳拍档',77,y+14,236,39);
  const py=y+93;p.panel(9,py,372,b-py);
  const ranked=[...m.ledger].sort((a,b)=>b.points-a.points),scenes=[...m.highlights].reverse();
  scroll(g,py+16,b-py-90,ranked.length*39+scenes.length*69+45,origin=>{
    ranked.forEach((a,i)=>{const ry=origin+i*39;row(p,29,ry,332,34,i===0);p.text((i+1)+'',47,ry+17,14,ink);p.avatar(g.images['avatar'+a.avatar],77,ry+17,12,'茶');p.text(a.name,99,ry+17,17,ink,{align:'left',max:150});p.heading(fmt(a.points),325,ry+17,22,ink,65);});
    let ry=origin+ranked.length*39+15;
    if(!scenes.length)p.text('吃牌、叠罚与反超，都会记在这里',195,ry+22,13,muted);
    scenes.forEach((s,i)=>{const line=ry+i*69;row(p,29,line,332,61);p.text('第 '+s.round+' 局',44,line+17,12,muted,{align:'left'});p.text(s.text,44,line+42,16,ink,{align:'left',max:294});});
  });p.button('保存战报',35,b-62,320,47,()=>g.exportReport(),'secondary');return true;
}
const AWARDS=[['吃牌高手','整手吃牌领先'],['加倍掌柜','叠加罚牌领先'],['连胜掌柜','连续获胜领先'],['反超王','逆转局势领先'],['报牌模范','准时报牌，无漏报']];
function awards(g){
  const p=g.paint,r=g.partyRecord||g.room,m=r?.match,y=header(g,'茶馆趣味称号'),b=end(g),earned=m?.awards||[];
  const id=g.awardIndex||0,award=AWARDS[id],holders=earned.filter(a=>a.title===award[0]);
  p.panel(10,y,370,115);p.sprite('ui-award-'+id,27,y+8,128,91);p.heading(award[0],254,y+32,25,ink,196);
  p.text(holders.length?holders.map(a=>a.name).join('、'):'暂未获得',254,y+65,16,holders.length?C.red:muted,{max:188});p.text(award[1],254,y+87,12,muted,{max:190});
  p.text('根据本场真实表现获得',195,y+132,14,C.cream);
  const step=Math.max(112,Math.min(158,(b-y-161)/3)),cellH=step-7;
  scroll(g,y+152,b-y-161,3*step,origin=>AWARDS.forEach(([name],i)=>{
    const x=22+i%2*179,ry=origin+Math.floor(i/2)*step,has=earned.some(a=>a.title===name);row(p,x,ry,167,cellH,i===id);
    p.sprite('ui-award-'+i,x+13,ry+2,141,cellH-28);plaque(p,has?'✓ 已获得':'未获得',x+25,ry+cellH-26,117,23,has?'secondary':'paper');p.hit(x,ry,167,cellH,()=>{g.awardIndex=i;});
  }));return true;
}
function themes(g){
  const p=g.paint,y=header(g,'我的茶桌'),b=end(g),selected=themeOf(g.preferences),bottom=b-116;
  scroll(g,y,bottom-y,Math.ceil(THEMES.length/2)*146,origin=>THEMES.forEach((theme,i)=>{
    const x=20+i%2*178,ry=origin+Math.floor(i/2)*146,is=theme.id===selected.id;
    if(ry+138<y||ry>bottom)return;row(p,x,ry,172,136,is);const im=g.images['ui-theme-scene-'+i]||g.themeImages?.get(theme,true);
    if(im){p.ctx.save();p.shape(x+4,ry+4,164,103,9);p.ctx.clip();p.ctx.drawImage(im,x+4,ry+4,164,103);p.ctx.restore();}
    else p.box(x+4,ry+4,164,103,9,p.gradient(ry,103,theme.a,theme.b));
    p.text(theme.name,x+86,ry+121,16,ink);p.hit(x,ry,172,136,()=>g.setAppearance('theme',theme.id));
  }));
  p.panel(10,b-109,370,109);plaque(p,'已选用 · '+selected.name,50,b-99,290,33,'primary');
  tabs(g,[['牌背',false,()=>{g.themePanel='backs';g.overlay='appearance';}],['大字牌',g.preferences.largeCards,()=>g.toggle('largeCards')],['环境声',g.preferences.ambience,()=>g.toggle('ambience')]],26,b-54,338,37);return true;
}
function replay(g){
  const p=g.paint,r=g.replayRecord;if(!r)return true;const history=r.history||[],i=Math.max(0,Math.min(g.replayIndex,history.length-1)),e=history[i];
  const y=header(g,'牌局回放','第 '+r.number+' 局 · 步骤 '+(e?i+1:0)+' / '+history.length),b=end(g),py=Math.max(y+180,b-300);
  scenic(g,y,py-y+11);plaque(p,'回顾模式 · 仅公开信息',78,y+11,234,29);
  if(e){p.card(e.top,155,y+56,80,111,e.top?'':'empty');p.text(describeEvent(e,r.players),195,py-23,14,C.light,{max:330});}
  p.panel(9,py,372,b-py);const sy=py+24;p.box(32,sy,326,6,3,'#CEC09D');p.box(32,sy,326*(history.length>1?i/(history.length-1):0),6,3,C.jade);p.circle(32+326*(history.length>1?i/(history.length-1):0),sy+3,8,C.gold);
  for(let n=0;n<history.length;n++){const x=32+326*n/Math.max(1,history.length-1);p.hit(x-4,sy-12,8,30,()=>g.replayStep(n-i));}
  p.button('上一步',27,py+48,105,43,i>0?()=>g.replayStep(-1):null,'secondary');p.button(g.replayPlaying?'暂停':'播放',143,py+48,104,43,history.length>1?()=>g.toggleReplay():null);p.button('下一步',258,py+48,105,43,i<history.length-1?()=>g.replayStep(1):null,'secondary');
  const first=Math.max(0,Math.min(i-1,history.length-3));history.slice(first,first+3).forEach((a,n)=>{const ry=py+108+n*36;row(p,28,ry,334,31,first+n===i);p.text(describeEvent(a,r.players),44,ry+16,12,ink,{align:'left',max:305});p.hit(28,ry,334,31,()=>g.replayStep(first+n-i));});
  if(!e)p.text('这局没有回放数据',195,py+144,18,muted);
  p.button('返回战绩',39,b-61,312,45,()=>g.back(),'secondary');return true;
}
function challenges(g){
  const p=g.paint,y=header(g,'茶馆练功房'),b=end(g),date=dayKey(),today=g.progress.days[date];
  p.panel(10,y,370,170);plaque(p,'今日练习',31,y+14,168,36,'primary');p.sprite('ui-tea-cup',228,y+25,122,65);
  p.text(date,112,y+74,18,ink);p.text(today?'今日完成 '+today.attempts+' 次':'今日未完成',112,y+100,12,muted);p.button('开始挑战',37,y+119,316,39,()=>g.startDaily(),'secondary');
  plaque(p,'残局挑战',107,y+185,176,35,'paper');
  scroll(g,y+235,b-y-247,Math.ceil(puzzles.length/3)*133,origin=>puzzles.forEach((a,i)=>{
    const x=20+i%3*119,ry=origin+Math.floor(i/3)*133,done=g.progress.puzzles[a.id];row(p,x,ry,111,123);
    plaque(p,String(i+1).padStart(2,'0'),x+31,ry+7,49,23);p.heading(a.title,x+55,ry+48,17,ink,98);
    p.text(done?'★'.repeat(done.stars):'○ 未挑战',x+55,ry+79,13,done?'#A67A25':muted);p.text(a.theme,x+55,ry+105,11,muted,{max:98});p.hit(x,ry,111,123,()=>g.startChallenge(a.id));
  }));return true;
}
function lesson(g){
  const p=g.paint,t=g.tutorial,q=g.room?.round;if(!t||!q)return true;const y=header(g,'新手教学'),b=end(g);
  p.panel(9,y,372,b-y);plaque(p,(t.index+1)+' / '+lessons.length+' · '+t.lesson.title,34,y+18,322,32,'paper');
  const sy=y+63,sceneH=Math.max(170,b-y-253);scenic(g,sy,sceneH);
  p.card(q.top,169,sy+14,52,73);const gap=Math.min(73,315/Math.max(1,q.hand.length)),first=(390-(q.hand.length-1)*gap-61)/2;
  q.hand.forEach((c,i)=>{const x=first+i*gap,cy=sy+sceneH-95-(g.selected===c.id?6:0);p.card(c,x,cy,61,85,g.selected===c.id?'selected':'');if(!t.complete)p.hit(x,cy,61,85,()=>g.select(c.id));});
  p.wrap(t.complete?t.lesson.done:t.lesson.instruction,34,sy+sceneH+20,322,14,ink,21);
  const ay=b-115,report=q.hand.length===1&&!q.reported[0];
  if(!t.complete){p.button(q.canEat?'吃牌':'摸牌',28,ay,110,40,q.canEat&&!report?()=>g.eat():!q.canEat&&!q.legal.length?()=>g.draw():null,'paper');p.button(report?'报牌':'试着出一张牌',148,ay,214,40,report?()=>g.report():g.selected?()=>g.playSelected():null,'secondary');}
  else p.button('✓ 本课已掌握',44,ay,302,40,()=>g.nextLesson(),'secondary');
  p.button('重练',29,b-62,92,38,()=>g.startTutorial(t.index),'paper');p.button(t.index===lessons.length-1?'人机练习':'下一课',131,b-62,230,38,t.complete?()=>g.nextLesson():null,'paper');return true;
}
function rules(g){
  const p=g.paint,y=header(g,'玩法规则'),b=end(g);p.panel(9,y,372,b-y-64);
  const blocks=copy.map(([title,text])=>({title,text,h:58+Math.ceil(text.length/20)*23}));
  scroll(g,y+18,b-y-101,blocks.reduce((n,a)=>n+a.h,0),origin=>{let ry=origin;blocks.forEach((a,i)=>{plaque(p,String(i+1).padStart(2,'0')+' '+a.title,31,ry,328,33,'paper');p.wrap(a.text,36,ry+52,317,15,ink,23);ry+=a.h;});});
  p.button('开始新手教学',42,b-54,306,44,()=>g.startTutorial(),'secondary');return true;
}
function challenge(g){
  const p=g.paint,t=g.challenge;if(!t)return true;const q=g.room.round,d=t.definition,b=end(g),felt=g.images['ui-felt-background'];
  if(felt)p.ctx.drawImage(felt,0,0,390,g.height);
  const y=header(g,'残局挑战 · '+d.title),star=g.progress.puzzles[d.id]?.stars||0;
  p.text('★'.repeat(star)+'☆'.repeat(3-star),195,y+3,22,C.gold);
  plaque(p,t.complete?'挑战完成 · '+'★'.repeat(t.hinted?2:3):t.failed?'再换个思路试试':d.goal==='eat'?'用整手吃牌赢下本局':d.theme,30,y+24,330,35,'paper');
  const py=y+73,ph=b-py-116;p.box(14,py,362,ph,25,'rgba(9,53,43,.64)',C.gold,2);p.box(19,py+5,352,ph-10,21,null,C.gold,.6);p.panelCorner(22,py+8,1,1);p.panelCorner(368,py+8,-1,1);
  plaque(p,'桌面顶牌',144,py+15,102,25);p.card(q.top,163,py+49,64,90);
  row(p,264,py+17,96,64);p.text('剩余操作',312,py+34,13,ink);p.heading(Math.max(0,d.limit-t.moves)+' 次',312,py+62,25,C.red,87);
  const opponents=t.round.hands[1],cg=Math.min(27,72/Math.max(1,opponents.length));opponents.slice(0,5).forEach((c,i)=>p.card(c,294-(Math.min(5,opponents.length)-1)*cg/2+i*cg,py+96,27,38));p.text('对手 '+opponents.length+' 张',312,py+147,11,C.cream);
  const hy=py+ph-158,gap=Math.min(75,305/Math.max(1,q.hand.length)),first=(390-(q.hand.length-1)*gap-66)/2;
  p.line(34,hy-15,356,hy-15,C.gold,.7);p.flower(195,hy-15,5,C.gold);
  q.hand.forEach((c,i)=>{const x=first+i*gap,cy=hy-(g.selected===c.id?7:0);p.card(c,x,cy,66,92,g.selected===c.id?'selected':'');if(!t.complete&&!t.failed)p.hit(x,cy,66,92,()=>g.select(c.id));});
  plaque(p,t.complete?'整手清空！':d.hint&&t.hinted?d.hint:'观察整手牌点数',30,py+ph-47,330,32,'paper');
  p.panel(9,b-101,372,101);
  const report=q.hand.length===1&&!q.reported[0],ay=b-80;p.button('返回',22,ay,80,43,()=>g.openChallenges(),'paper');
  p.button(t.complete||t.failed?'重试':report?'报牌':q.canEat?'吃牌':g.selected?'出牌':'摸牌',112,ay,166,43,t.complete||t.failed?()=>g.startChallenge(d.id):report?()=>g.report():q.canEat?()=>g.eat():g.selected?()=>g.playSelected():!q.legal.length?()=>g.draw():null);
  p.button('提示',288,ay,80,43,!t.complete&&!t.failed?()=>g.challengeHint():null,'secondary');p.text('报牌不计操作次数 · 独立通关获得三星',195,b-16,10,ink);return true;
}

function spectator(g){
 const p=g.paint,r=g.room;if(!r)return true;const q=r.round,b=end(g),panelY=Math.max(g.top+284,b*.56);
 const scene=g.images['ui-salon-background'];if(scene)p.ctx.drawImage(scene,0,0,390,panelY/ .55);
 p.brand(112,g.top-6,166,62);p.titleBadge('候补观战',113,g.top+61,164,35,true);p.icon('‹',12,g.top+2,()=>g.back());
 const tableTop=g.top+121,tableBottom=panelY-39,cy=(tableTop+tableBottom)/2;
 r.players.forEach((a,i)=>{const angle=-Math.PI/2+i*Math.PI*2/r.players.length,x=195+139*Math.cos(angle),yy=cy+(tableBottom-tableTop)/2*Math.sin(angle);
  p.avatar(g.images['avatar'+a.avatar],x,yy,20,a.name.slice(-1));plaque(p,a.name+' · '+(q?.handCounts[i]??0)+'张',Math.max(15,Math.min(275,x-50)),yy+20,100,24,'paper');
 });if(q?.top)p.card(q.top,142,cy-24,45,62);p.card(null,207,cy-24,45,62);
 p.panel(8,panelY,374,b-panelY);p.text('当前观战 '+(r.spectators?.length||0)+' 人   |   '+(r.queued?'候补第 '+r.queuePosition+' 位':'仅展示公开信息'),195,panelY+34,16,ink);
 (r.spectators||[]).slice(0,4).forEach((a,i)=>{const x=66+i*86;p.avatar(g.images['avatar'+(a.avatar||0)],x,panelY+87,23,'茶');p.text(a.name,x,panelY+124,15,ink,{max:75});});
 p.button(r.queued?'已加入候补':'申请下一局入座',36,b-144,318,43,!g.busy?()=>g.send('queue',{enabled:!r.queued}):null,'secondary');
 p.text('下一局有空位时入座',195,b-80,14,muted);p.button('退出观战',76,b-57,238,40,()=>{g.overlay='leave';},'paper');return true;
}

function closed(g){const p=g.paint,y=header(g,'加入好友房'),b=end(g);p.panel(9,y,372,b-y);p.sprite('ui-tea-cup',70,y+22,250,132);p.heading('房间已结束或不存在',195,y+185,27,ink,337);p.text('请确认房间号，或请好友重新开桌',195,y+223,14,muted);for(let i=0;i<6;i++){row(p,37+i*54,y+259,46,56);p.heading(g.roomCode[i]||'—',60+i*54,y+287,29,ink);}p.button('重新输入',26,b-86,161,48,()=>{g.page='join';g.connecting='';},'paper');p.button('返回大厅',201,b-86,163,48,()=>g.home(),'secondary');return true;}
function practice(g){
 const p=g.paint,y=header(g,'人机练习'),b=end(g);p.panel(9,y,372,b-y-73);
 const groups=[['桌位人数','players',[2,3,4,5,6],n=>n+'人'],['牌副数','decks',[1,2,3,4],n=>n+'副'],['牌堆用完','exhaustion',['shuffle','draw'],n=>n==='shuffle'?'洗牌继续':'直接流局']];
 scroll(g,y+20,b-y-113,365,origin=>{groups.forEach(([name,key,values,label],i)=>{const ry=origin+i*76;p.text(name,37,ry+9,16,ink,{align:'left'});tabs(g,values.map(v=>[label(v),g.options[key]===v,()=>{g.options[key]=v;}]),31,ry+28,328,35);});p.text('电脑难度',37,origin+237,16,ink,{align:'left'});tabs(g,DIFFICULTIES.map(d=>[d.name,g.difficulty===d.id,()=>{g.difficulty=d.id;}]),31,origin+259,328,38);p.text(DIFFICULTIES.find(d=>d.id===g.difficulty)?.detail||'',195,origin+326,13,muted,{max:320});});
 p.button('开始练习',30,b-61,330,49,()=>g.startPractice());return true;
}
function party(g){const p=g.paint,r=g.room,y=header(g,'茶桌事务'),b=end(g);if(!r)return true;const actions=[['好友整场赛',()=>g.openPartyPage('matchBoard')],['茶馆趣味称号',()=>g.openPartyPage('awards')],['名场面战报',()=>g.openPartyPage('warReport')],['我的茶桌',()=>g.openPartyPage('themes')],['表情与语音',()=>g.openSocial()]];if(r.round)actions.push(['积分明细',()=>g.open('scores')]);if(r.code&&!r.watching&&!r.ended){actions.push([r.paused?'恢复牌局':'投票暂停',r.paused?(r.self===r.host?()=>g.send('unpause'):null):()=>g.confirmVote('pause')],['投票散桌',()=>g.confirmVote('dissolve')]);}actions.push(['退出房间',()=>{g.overlay='leave';}]);p.panel(9,y,372,b-y);scroll(g,y+17,b-y-34,actions.length*58,origin=>actions.forEach(([label,a],i)=>p.button(label,33,origin+i*58,324,47,!g.busy?a:null,i===actions.length-1?'paper':'secondary')));return true;}
const views={records,result,scores:result,scoreDetail:detail,matchBoard:match,warReport:report,awards,themes,replay,challenges,tutorial:lesson,rules,challenge,spectator,closed,party,practice};
function drawReference(g){if(!g.platform.uiImage)return false;return views[g.page]?.(g)||false;}
module.exports={drawReference,header,plaque,row,scroll,scenic,empty,views};
