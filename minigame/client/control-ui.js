'use strict';
const {ControlClient}=require('./control-client');
const {C,ranks,symbols}=require('./paint');
const {SUITS,SUIT_NAMES}=require('../shared/rules');
const CARD_ROWS=5;
const KEY_SETS=['1234567890qwertyuiopasdfghjklzxcvbnm','1234567890QWERTYUIOPASDFGHJKLZXCVBNM','!@#$%^&*()-_=+[]{};:\'",.<>/?\\|`~ '];
class ControlUI{
 constructor(game){this.g=game;this.password='';this.keys=0;this.rooms=[];this.room=null;this.tab='manage';this.offset=0;this.seat=0;this.chosen=new Set();this.cardPage=0;this.scores=[];
  this.client=new ControlClient(game.platform,message=>{if(!this.client?.token&&game.page==='control'){this.room=null;this.rooms=[];this.confirm=null;game.page='controlLogin';if(message)game.toast(message);}game.invalidate();});
 }
 open(){this.password='';this.error='';this.g.page=this.client.token?'control':'controlLogin';this.g.rulesScroll=0;this.g.invalidate();}
 key(key){if(this.g.page!=='controlLogin'||this.busy||this.secretEditing)return false;
  if(key==='Backspace'||key==='⌫')this.password=this.password.slice(0,-1);
  else if(key==='清空')this.password='';
  else if(key==='Enter'){this.login();return true;}
  else if(key.length===1&&/^[\x20-\x7e]$/.test(key)&&this.password.length<256)this.password+=key;
  else return false;this.error='';this.g.invalidate();return true;
 }
 async run(fn){if(this.busy)return;this.busy=true;this.error='';this.g.invalidate();try{await fn();}catch(e){this.error=e.message;this.g.toast(e.message);}finally{this.busy=false;this.g.invalidate();}}
 login(){if(this.password.length<16){this.error='请输入至少 16 位的管理员密码';this.g.invalidate();return;}
  const value=this.password;this.password='';this.run(async()=>{await this.client.login(value);this.g.page='control';this.g.rulesScroll=0;await this.list();});}
 async list(){const data=await this.client.request('rooms');this.rooms=data.rooms;this.offset=Math.min(this.offset,Math.max(0,Math.floor((this.rooms.length-1)/6)*6));}
 show(room,reset=true){this.room=room;if(reset)this.g.rulesScroll=0;this.confirm=null;this.seat=room.players.find(p=>!p.released)?.seat||0;this.resetEditor();}
 resetEditor(){this.chosen=new Set(this.room?.round?.hands[this.seat]?.map(c=>c.id)||[]);this.cardPage=0;this.nextCard=null;this.scores=this.room?.round?.scores.slice()||[];this.turn=this.room?.round?.turn||0;this.penalty=this.room?.round?.penalty||0;this.suit=this.room?.round?.chosenSuit||null;}
 load(code){this.run(async()=>this.show((await this.client.request('room',{code})).room));}
 action(action,fields={}){const room=this.room;if(!room)return;this.run(async()=>{const data=await this.client.request('action',{...fields,code:room.code,rev:room.rev,action});this.show(data.room,false);this.g.toast(data.message);});}
 ask(label,action,fields={}){this.confirm={label,action,fields,rev:this.room.rev,code:this.room.code};this.g.invalidate();}
 confirmAction(){const confirm=this.confirm;this.confirm=null;if(confirm&&this.room?.rev===confirm.rev&&this.room.code===confirm.code)this.action(confirm.action,confirm.fields);}
 back(){if(this.confirm){this.confirm=null;}else if(this.room){this.room=null;this.g.rulesScroll=0;this.run(()=>this.list());}else {this.close();this.g.page='join';}this.g.invalidate();}
 close(){this.cancelSecret?.();this.cancelSecret=null;this.password='';this.room=null;this.rooms=[];this.confirm=null;this.error='';this.client.disconnect();}
 editPassword(){if(!this.g.platform.editSecret||this.busy||this.secretEditing)return;this.secretEditing=true;
  this.cancelSecret=this.g.platform.editSecret(this.password,value=>{this.secretEditing=false;this.cancelSecret=null;if(value!==null)this.password=value;this.g.invalidate();});}
 button(text,x,y,w,action,enabled=true,kind='paper',h=40){this.g.paint.button(text,x,y,w,h,enabled&&!this.busy?action:null,kind);}
 drawLogin(){const g=this.g,p=g.paint,top=g.top,b=g.height-g.bottom;
  p.icon('‹',18,top+3,()=>this.back());p.heading('管理员入口',207,top+27,26,C.cream,270);
  const y=top+74,h=b-y;p.panel(15,y,360,h);
  p.text('输入管理密码，验证后打开控制台',195,y+28,13,C.ink);
  p.box(31,y+51,328,54,10,'#FFF8E8',C.gold,1.2);
  p.text(this.password?'•'.repeat(Math.min(24,this.password.length)):g.platform.editSecret?'点此输入密码，或使用下方键盘':'请用下方键盘输入',195,y+78,this.password?18:13,this.password?C.ink:'#887653',{max:301});
  if(g.platform.editSecret&&!this.busy)p.hit(31,y+51,328,54,()=>this.editPassword());
  p.text('已输入 '+this.password.length+' 位 · 密码不会保存到本机',195,y+126,11,C.ink);
  const base=y+146,keyH=Math.min(43,Math.max(29,(h-302)/4)),keys=KEY_SETS[this.keys];
  for(let i=0;i<keys.length;i++){const char=keys[i],x=30+(i%10)*33,cy=base+Math.floor(i/10)*keyH;
   p.box(x,cy,30,keyH-5,5,'#FFF6DE','#BFA46D',1);p.text(char===' '?'␣':char,x+15,cy+(keyH-5)/2,17,C.ink,{max:26});if(!this.busy)p.hit(x,cy,30,keyH-5,()=>this.key(char));}
  const foot=base+keyH*4+6;
  [['小写',0],['大写',1],['符号',2]].forEach(([label,set],i)=>this.button(label,31+i*76,foot,70,()=>{this.keys=set;},true,this.keys===set?'secondary':'paper',34));
  this.button('退格',259,foot,98,()=>this.key('Backspace'),true,'paper',34);
  this.button('清空',31,foot+43,78,()=>this.key('清空'),true,'paper',42);
  this.button(this.busy?'正在验证…':'验证并进入',119,foot+43,238,()=>this.login(),this.password.length>=16,'secondary',42);
  p.text(this.error||'使用服务器设置的管理员密码',195,Math.min(b-20,foot+104),11,this.error?C.red:'#766247',{max:321});
 }
 draw(){if(this.g.page==='controlLogin'){this.drawLogin();return;}const g=this.g,p=g.paint,top=g.top,b=g.height-g.bottom;
  p.icon('‹',16,top+3,()=>this.back());p.heading(this.room?'牌桌 '+this.room.code:'牌局控制台',201,top+27,24,C.cream,254);
  const y=top+72;p.panel(12,y,366,b-y);
  if(!this.room)this.drawRooms(y,b);else this.drawRoom(y,b);
  if(this.confirm){p.hits=[];p.box(0,0,390,g.height,0,'rgba(0,15,10,.75)');const cy=Math.max(top+45,(g.height-239)/2);p.panel(22,cy,346,239);
   p.heading(this.confirm.label,195,cy+48,23,C.ink,290);p.text('操作将立即同步到这张牌桌',195,cy+96,13,C.ink);
   this.button('取消',44,cy+147,143,()=>{this.confirm=null;},true,'paper',48);this.button('确认操作',202,cy+147,143,()=>this.confirmAction(),true,'secondary',48);}
 }
 drawRooms(y,b){const p=this.g.paint,per=6;
  p.text('选择房间或创建测试牌桌',195,y+27,14,C.ink);
  this.button('刷新列表',28,y+49,155,()=>this.run(()=>this.list()));
  this.button('创建测试桌',197,y+49,164,()=>this.run(async()=>{this.show((await this.client.request('demo')).room);this.tab='debug';}),true,'secondary');
  const available=b-y-209,rowH=Math.min(58,available/per);this.rooms.slice(this.offset,this.offset+per).forEach((r,i)=>{
   const cy=y+105+i*rowH;p.box(28,cy,333,rowH-7,8,'#FFF6DE','#D5BB80',1);p.text(r.code,43,cy+(rowH-7)/2,19,C.ink,{align:'left'});
   p.text(r.ended?'已散桌':r.paused?'已暂停':r.round?'第'+r.round+'局':'待开局',344,cy+(rowH-7)/2,12,C.ink,{align:'right'});p.text(r.players+' 人',206,cy+(rowH-7)/2,12,C.ink);
   if(!this.busy)p.hit(28,cy,333,rowH-7,()=>this.load(r.code));});
  if(!this.rooms.length)p.text(this.busy?'正在读取…':'暂无房间，可先创建测试桌',195,y+174,14,C.ink);
  this.button('上一页',28,b-95,102,()=>{this.offset-=per;},this.offset>0);
  p.text((Math.floor(this.offset/per)+1)+' / '+Math.max(1,Math.ceil(this.rooms.length/per)),195,b-75,13,C.ink);
  this.button('下一页',260,b-95,102,()=>{this.offset+=per;},this.offset+per<this.rooms.length);
  this.button('退出管理',96,b-46,198,()=>{this.close();this.g.page='join';},true,'paper',34);
 }
 scroll(y,b,total,draw){const g=this.g,p=g.paint,body={x:23,y,w:344,h:b-y},first=p.hits.length;
  const max=Math.max(0,total-body.h);g.rulesScroll=Math.max(0,Math.min(max,g.rulesScroll||0));p.ctx.save();p.shape(body.x,y,body.w,body.h,0);p.ctx.clip();draw(y-g.rulesScroll);p.ctx.restore();
  p.hits=p.hits.slice(0,first).concat(p.hits.slice(first).flatMap(hit=>{const top=Math.max(hit.y,y),bottom=Math.min(hit.y+hit.h,b);return bottom>top?[{...hit,y:top,h:bottom-top}]:[];}));g.scrollZone={...body,type:'rules',max};
 }
 drawRoom(y,b){const p=this.g.paint,r=this.room;
  p.text(r.ended?'已散桌':r.paused?'已暂停 · 可逐步调试':'运行中 · 修改即时生效',195,y+22,13,C.ink);
  this.button('刷新牌局',268,y+40,93,()=>this.load(r.code),true,'paper',34);
  [['房间管理','manage'],['牌局调试','debug'],['记录','audit']].forEach(([label,id],i)=>this.button(label,26+i*80,y+40,75,()=>{this.tab=id;this.g.rulesScroll=0;},true,this.tab===id?'secondary':'paper',34));
  const body=y+90;
  if(this.tab==='manage')this.scroll(body,b-10,152+r.players.length*133,cy=>this.drawManage(cy));
  else if(this.tab==='audit')this.scroll(body,b-10,Math.max(70,r.audit.length*54),cy=>{r.audit.slice().reverse().forEach((a,i)=>{p.text(a.label+(a.seat===null?'':' · '+(a.seat+1)+'号'),34,cy+i*54+16,14,C.ink,{align:'left'});p.text(new Date(a.at).toLocaleTimeString(),34,cy+i*54+37,11,'#7A6A4C',{align:'left'});});});
  else this.scroll(body,b-10,this.debugHeight(),cy=>this.drawDebug(cy));
 }
 drawManage(y){const p=this.g.paint,r=this.room,q=r.round,active=!r.ended&&q&&!q.result;
  this.button(r.paused?'恢复':'暂停',28,y,101,()=>this.action(r.paused?'resume':'pause'),active,'secondary');
  this.button('管理员开局',136,y,116,()=>this.ask('确认管理员开局','start'),!r.ended&&!q&&r.players.length>=2);
  this.button('散桌',259,y,101,()=>this.ask('确认散桌','dissolve'),!r.ended);
  p.text('对局中移出将由电脑接手，旧凭据失效',195,y+65,11,C.ink);
  r.players.forEach((a,i)=>{const cy=y+87+i*133;p.box(27,cy,335,120,10,'#FFF4D9','#D0B67C',1);
   p.text((i+1)+'号 '+a.name+(a.host?' · 房主':''),39,cy+24,15,C.ink,{align:'left',max:307});
   p.text((a.released?'已移出':a.online?'在线':'离线')+' · '+(a.auto?'电脑托管':'本人操作')+(q?' · '+q.hands[i].length+'张 · '+q.scores[i]+'分':''),39,cy+51,11,C.ink,{align:'left',max:307});
   this.button(a.auto?'取消托管':'开启托管',36,cy+72,104,()=>this.action('auto',{seat:i,enabled:!a.auto}),active&&!a.released&&(!a.auto||!a.returnNextRound),'paper',34);
   this.button('转让房主',148,cy+72,98,()=>this.action('transfer',{seat:i}),!r.ended&&!a.host&&a.online&&!a.released,'paper',34);
   this.button('移出',254,cy+72,98,()=>this.ask('移出 '+a.name,'kick',{seat:i}),!r.ended&&!a.released&&r.players.length>1,'paper',34);
  });
 }
 debugHeight(){const q=this.room.round;if(!q)return 80;const view=90+q.hands.reduce((n,h)=>n+40+Math.ceil(h.length/7)*68,0);return view+(q.result||this.room.ended?0:960+this.room.players.length*49);}
 drawCards(cards,y,selected,click){const p=this.g.paint;cards.forEach((c,i)=>{const x=30+i%7*47,cy=y+Math.floor(i/7)*68;p.card(c,x,cy,42,59,selected?.has(c.id)?'selected':'');if(click&&!this.busy)p.hit(x,cy,42,59,()=>click(c));});return Math.ceil(cards.length/7)*68;}
 drawDebug(y){const r=this.room,q=r.round,p=this.g.paint;if(!q){p.text('请先在房间管理中开局',195,y+28,14,C.ink);return;}
  p.text('轮到 '+r.players[q.turn].name+' · 摸牌堆 '+q.deck.length+' · 罚摸 '+q.penalty,33,y+17,12,C.ink,{align:'left',max:327});
  p.text('桌面顶牌',34,y+59,12,C.ink,{align:'left'});if(q.discard.length)p.card(q.discard.at(-1),112,y+29,37,52);y+=91;
  q.hands.forEach((hand,i)=>{p.text((i+1)+'号 '+r.players[i].name+' · '+q.scores[i]+'分',33,y+13,13,C.ink,{align:'left',max:326});y+=31;y+=this.drawCards(hand,y);y+=9;});
  if(q.result||r.ended||!r.players.some(a=>!a.released)){p.text('当前牌局仅可查看',195,y+24,13,C.ink);return;}
  this.button('电脑走一步',31,y+6,328,()=>this.action('step'),!!r.paused,'secondary');y+=68;
  p.text('编辑目标座位',34,y+10,13,C.ink,{align:'left'});y+=31;
  r.players.forEach((a,i)=>this.button((i+1)+'号',30+i*55,y,50,()=>{this.seat=i;this.resetEditor();},!a.released,this.seat===i?'secondary':'paper',33));y+=54;
  p.text('指定手牌 · 已选 '+this.chosen.size+' 张',33,y+9,14,C.ink,{align:'left'});y+=29;
  const pool=[...new Map([...q.hands[this.seat],...q.deck,...q.hands.flat(),...q.discard.slice(0,-1)].map(c=>[c.id,c])).values()];
  const pageSize=7*CARD_ROWS,maxPage=Math.max(0,Math.ceil(pool.length/pageSize)-1);this.cardPage=Math.min(this.cardPage,maxPage);
  this.drawCards(pool.slice(this.cardPage*pageSize,(this.cardPage+1)*pageSize),y,this.chosen,c=>{this.chosen.has(c.id)?this.chosen.delete(c.id):this.chosen.add(c.id);});y+=CARD_ROWS*68;
  this.button('上一页',31,y,96,()=>{this.cardPage--;},this.cardPage>0,'paper',33);p.text((this.cardPage+1)+'/'+(maxPage+1),195,y+17,12,C.ink);this.button('下一页',263,y,96,()=>{this.cardPage++;},this.cardPage<maxPage,'paper',33);y+=44;
  this.button('清空选择',31,y,105,()=>{this.chosen.clear();},true,'paper',38);this.button('应用手牌',147,y,212,()=>this.action('hand',{seat:this.seat,cards:[...this.chosen]}),this.chosen.size>0&&!r.players[this.seat].released,'secondary',38);y+=58;
  const current=this.nextCard||q.deck.at(-1)?.id,idx=q.deck.findIndex(c=>c.id===current),card=q.deck[idx];
  p.text('下一张：'+(card?ranks[card.rank]+symbols[card.suit]+' · 第'+(Number(card.id.split('-')[0])+1)+'副':'摸牌堆为空'),33,y+11,13,C.ink,{align:'left'});y+=30;
  this.button('换一张',31,y,105,()=>{this.nextCard=q.deck[(idx+1)%q.deck.length].id;},q.deck.length>0,'paper',37);this.button('指定下一张',147,y,212,()=>this.action('drawNext',{cardId:current}),!!current,'secondary',37);y+=58;
  p.text('回合：'+(this.turn+1)+'号 · 待罚摸 '+this.penalty+' 张',33,y+10,13,C.ink,{align:'left'});y+=29;
  this.button('切换座位',31,y,105,()=>{const eligible=r.players.filter(a=>!a.released).map(a=>a.seat);this.turn=eligible[(eligible.indexOf(this.turn)+1)%eligible.length]??0;},true,'paper',35);
  this.button('罚摸 +2',146,y,102,()=>{this.penalty=(this.penalty+2)%210;},q.discard.at(-1)?.rank===2,'paper',35);this.button('清零',258,y,101,()=>{this.penalty=0;},true,'paper',35);y+=46;
  const choices=[null,...SUITS];this.button(this.suit?SUIT_NAMES[this.suit]:'跟随桌面花色',31,y,150,()=>{this.suit=choices[(choices.indexOf(this.suit)+1)%choices.length];},q.discard.at(-1)?.rank===8,'paper',37);
  this.button('应用回合',192,y,167,()=>this.action('turn',{seat:this.turn,penalty:this.penalty,suit:this.suit}),true,'secondary',37);y+=61;
  p.text('积分调整 · 总和须保持 '+q.scores.reduce((a,b)=>a+b,0),33,y+10,13,C.ink,{align:'left'});y+=31;
  r.players.forEach((a,i)=>{p.text((i+1)+'号 '+a.name,33,y+18,12,C.ink,{align:'left',max:115});p.text(this.scores[i],195,y+18,17,C.ink);this.button('−',238,y,54,()=>{this.scores[i]--;},true,'paper',35);this.button('+',301,y,54,()=>{this.scores[i]++;},true,'paper',35);y+=49;});
  this.button('应用积分',31,y+3,328,()=>this.action('scores',{scores:this.scores.slice()}),true,'secondary');
 }
}
function drawControl(game){if(!['control','controlLogin'].includes(game.page))return false;game.control?.draw();return true;}
module.exports={ControlUI,drawControl};
