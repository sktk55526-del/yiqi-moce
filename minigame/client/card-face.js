'use strict';
const glyphs = require('./card-glyphs');
const RANKS = ['','A','2','3','4','5','6','7','8','9','10','J','Q','K'];

// Fixed outlines keep the one-way corner index identical across phone fonts.
// Both digits of 10 use one natural-width run; neither digit is stretched.
function rankMetrics(label) {
  let advance=0, minX=Infinity, minY=Infinity, maxX=-Infinity, maxY=-Infinity;
  const letters=[];
  for(const character of label){
    const glyph=glyphs[character];
    if(!glyph)continue;
    letters.push({glyph,x:advance});
    minX=Math.min(minX,advance+glyph.bounds[0]);minY=Math.min(minY,glyph.bounds[1]);
    maxX=Math.max(maxX,advance+glyph.bounds[2]);maxY=Math.max(maxY,glyph.bounds[3]);
    advance+=glyph.advance;
  }
  return {letters,minX,minY,maxX,maxY,width:maxX-minX,height:maxY-minY};
}
const METRICS=Object.fromEntries(RANKS.filter(Boolean).map(rank=>[rank,rankMetrics(rank)]));

function drawRank(ctx,label,x,top,height,maxWidth,ink){
  const m=METRICS[label];if(!m)return;
  const scale=Math.min(height/m.height,maxWidth/m.width);
  ctx.save();ctx.translate(x-m.width*scale/2-m.minX*scale,top+m.maxY*scale);ctx.scale(scale,-scale);
  ctx.fillStyle=ink;ctx.beginPath();
  for(const {glyph,x:offset} of m.letters){
    for(const v of glyph.path){
      const op=v[0];
      if(op==='M')ctx.moveTo(v[1]+offset,v[2]);
      else if(op==='L')ctx.lineTo(v[1]+offset,v[2]);
      else if(op==='C')ctx.bezierCurveTo(v[1]+offset,v[2],v[3]+offset,v[4],v[5]+offset,v[6]);
      else if(op==='Q')ctx.quadraticCurveTo(v[1]+offset,v[2],v[3]+offset,v[4]);
      else ctx.closePath();
    }
  }
  ctx.fill();ctx.restore();
}

function drawSuit(ctx,suit,x,y,size,ink){
  ctx.save();ctx.translate(x,y);ctx.scale(size,size);ctx.fillStyle=ink;ctx.beginPath();
  if(suit==='diamond'){
    ctx.moveTo(0,-.5);
    ctx.bezierCurveTo(.10,-.27,.24,-.10,.35,0);
    ctx.bezierCurveTo(.22,.14,.10,.30,0,.5);
    ctx.bezierCurveTo(-.10,.30,-.22,.14,-.35,0);
    ctx.bezierCurveTo(-.24,-.10,-.10,-.27,0,-.5);
  }else if(suit==='heart'){
    ctx.moveTo(0,.5);
    ctx.bezierCurveTo(-.16,.24,-.5,-.02,-.5,-.24);
    ctx.bezierCurveTo(-.5,-.56,-.12,-.60,0,-.30);
    ctx.bezierCurveTo(.12,-.60,.5,-.56,.5,-.24);
    ctx.bezierCurveTo(.5,-.02,.16,.24,0,.5);
  }else if(suit==='spade'){
    ctx.moveTo(0,-.5);
    ctx.bezierCurveTo(-.12,-.24,-.42,-.03,-.42,.11);
    ctx.bezierCurveTo(-.42,.39,-.13,.40,-.035,.22);
    ctx.bezierCurveTo(-.03,.34,-.08,.44,-.16,.5);
    ctx.lineTo(.16,.5);
    ctx.bezierCurveTo(.08,.44,.03,.34,.035,.22);
    ctx.bezierCurveTo(.13,.40,.42,.39,.42,.11);
    ctx.bezierCurveTo(.42,-.03,.12,-.24,0,-.5);
  }else{
    // Overlapping filled subpaths have matching winding and an explicit center.
    // This keeps the clover opaque even on the small score-detail cards.
    for(const [cx,cy,r] of [[0,-.25,.25],[-.25,.105,.25],[.25,.105,.25],[0,.07,.18]]){
      ctx.moveTo(cx+r,cy);ctx.arc(cx,cy,r,0,Math.PI*2);ctx.closePath();
    }
    ctx.moveTo(.045,.16);ctx.bezierCurveTo(.045,.33,.09,.43,.16,.5);
    ctx.lineTo(-.16,.5);ctx.bezierCurveTo(-.09,.43,-.045,.33,-.045,.16);
    ctx.closePath();ctx.fill();ctx.restore();return;
  }
  ctx.closePath();ctx.fill();ctx.restore();
}

function cardLayout(w,h,rank,large=false){
  const unit=Math.min(w,h/1.42), factor=large?1.12:1;
  const rankHeight=unit*(rank===10?.23:.25)*factor;
  const cornerSuitSize=unit*.18*factor,top=h*.055;
  return {unit,cornerX:unit*(rank===10?.25:.225),top,
    rankHeight,rankWidth:unit*(rank===10?.29:.27)*factor,
    cornerSuitY:top+rankHeight+unit*.035+cornerSuitSize/2,cornerSuitSize,
    centerX:w/2,centerY:h*.60};
}

function paperLattice(ctx,x,y,w,h,u){
  const step=u*.13,extent=Math.hypot(w,h);
  ctx.save();ctx.translate(x+w/2,y+h/2);ctx.rotate(Math.PI/4);
  ctx.beginPath();
  // Anchor the weave to the card center. Starting at -extent made its phase
  // slide whenever a flying card changed aspect ratio.
  for(let index=-Math.ceil(extent/step);index<=Math.ceil(extent/step);index++){
    const n=index*step;
    ctx.moveTo(n,-extent);ctx.lineTo(n,extent);
    ctx.moveTo(-extent,n);ctx.lineTo(extent,n);
  }
  ctx.lineWidth=u*.0036;ctx.strokeStyle='rgba(198,157,83,.10)';ctx.stroke();
  ctx.restore();
}

function fretCorner(ctx,x,y,u,flipX,flipY,small=false){
  ctx.save();ctx.translate(x,y);ctx.scale(flipX,flipY);
  const q=u*(small?.006:.025);
  ctx.beginPath();ctx.moveTo(q*6,0);ctx.lineTo(q*6,q*2);ctx.lineTo(q*2,q*2);ctx.lineTo(q*2,q*6);ctx.lineTo(0,q*6);
  ctx.moveTo(q*4,0);ctx.lineTo(q*4,q*4);ctx.lineTo(0,q*4);
  ctx.moveTo(0,q);ctx.lineTo(q*3,q);ctx.lineTo(q*3,q*3);ctx.lineTo(q,q*3);ctx.lineTo(q,0);
  ctx.lineWidth=Math.max(.6,u*.006);ctx.lineJoin='round';ctx.lineCap='round';
  ctx.strokeStyle='#CBA565';ctx.stroke();ctx.restore();
}

function drawCardFace(p,card,x,y,w,h){
  const ctx=p.ctx,ink=['heart','diamond'].includes(card.suit)?'#AC2013':'#29271D';
  const l=cardLayout(w,h,card.rank,p.appearance?.largeCards),u=l.unit,r=u*.084;
  p.box(x,y,w,h,r,'#F8E7BF','#D4B57D',Math.max(.5,u*.003));
  const paper=p.assets?.['ui-card-paper'];
  ctx.save();p.shape(x,y,w,h,r);ctx.clip();
  if(paper)ctx.drawImage(paper,x,y,w,h);
  if(p.cardLattice)p.cardLattice(ctx,x,y,w,h,u);else paperLattice(ctx,x,y,w,h,u);
  ctx.restore();
  const inset=u*.048,innerRadius=r*.55;
  p.box(x+inset,y+inset,w-inset*2,h-inset*2,innerRadius,null,'#CAA362',Math.max(.65,u*.005));
  p.box(x+inset+u*.008,y+inset+u*.008,w-inset*2-u*.016,h-inset*2-u*.016,innerRadius,null,'rgba(255,251,225,.85)',Math.max(.35,u*.003));
  fretCorner(ctx,x+inset,y+inset,u,1,1,true);
  fretCorner(ctx,x+w-inset,y+inset,u,-1,1);
  fretCorner(ctx,x+inset,y+h-inset,u,1,-1);
  fretCorner(ctx,x+w-inset,y+h-inset,u,-1,-1);
  p.box(x+.6,y+.6,w-1.2,h-1.2,r,null,'#FFF4D9',Math.max(.7,u*.005));
  const centralScale={spade:.54,heart:.46,club:.54,diamond:.54}[card.suit]||.54;
  drawSuit(ctx,card.suit,x+l.centerX,y+l.centerY,u*centralScale,ink);
  const corner=()=>{
    drawRank(ctx,RANKS[card.rank],l.cornerX,l.top,l.rankHeight,l.rankWidth,ink);
    drawSuit(ctx,card.suit,l.cornerX,l.cornerSuitY,l.cornerSuitSize,ink);
  };
  ctx.save();ctx.translate(x,y);corner();ctx.restore();
}

module.exports={drawCardFace,drawRank,drawSuit,cardLayout,paperLattice};
