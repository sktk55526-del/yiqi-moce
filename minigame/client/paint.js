'use strict';
const { drawCardFace, paperLattice } = require('./card-face');
const { textSize, avatarRadius } = require('./ui-scale');

const C = {
  pine: '#0A332D', jade: '#12483D', ink: '#163D32', cream: '#F5E8C8',
  light: '#FFF4DB', gold: '#C6A15B', hot: '#D96A48', red: '#B94736',
  line: '#D1BB8C', muted: '#D5CBAE', grey: '#567066', shade: '#041F1B',
};
const symbols = { spade: '♠', heart: '♥', club: '♣', diamond: '♦' };
const ranks = ['','A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const font = '"PingFang SC","Microsoft YaHei",sans-serif';
const displayFont = '"STSong","Songti SC","SimSun","Noto Serif CJK SC",serif';

class Paint {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.hits = [];
    this.textMetrics = new Map();
  }

  setUiFont(family) {
    this.uiFont = '"' + String(family).replace(/["\\]/g, '') + '",' + font;
    this.textMetrics.clear();
  }

  shape(x, y, w, h, radius) {
    const g = this.ctx;
    const r = Math.min(radius, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  box(x, y, w, h, r, fill, stroke, width = 1) {
    const g = this.ctx;
    this.shape(x, y, w, h, r);
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = width; g.stroke(); }
  }

  circle(x, y, r, fill, stroke, width = 1) {
    const g = this.ctx;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = width; g.stroke(); }
  }

  line(x, y, x2, y2, color, width = 1) {
    const g = this.ctx;
    g.strokeStyle = color;
    g.lineWidth = width;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x2, y2);
    g.stroke();
  }

  text(value, x, y, size = 16, color = C.cream, options = {}) {
    const { align = 'center', weight = 500, max, maxHeight, family = this.uiFont || font, baseline = 'middle' } = options;
    const g = this.ctx, label = String(value);
    let pixels = options.exactSize ? size : textSize(size);
    g.fillStyle = color;
    g.textAlign = align;
    // Measure alphabetic ink bounds: Canvas's 'middle' baseline varies with font
    // fallback, and fillText(maxWidth) can squash only the horizontal dimension.
    g.textBaseline = 'alphabetic';
    const measure = () => {
      g.font = weight + ' ' + pixels + 'px ' + family;
      const key = g.font + '|' + align + '|' + label;
      let metrics = this.textMetrics.get(key);
      if (!metrics) {
        metrics = g.measureText(label);
        if (this.textMetrics.size >= 512) this.textMetrics.clear();
        this.textMetrics.set(key, metrics);
      }
      return metrics;
    };
    let metrics = measure();
    const inkHeight = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
    const scale = Math.min(1, max > 0 && metrics.width > 0 ? max / metrics.width : 1,
      maxHeight > 0 && inkHeight > 0 ? maxHeight / inkHeight : 1);
    if (scale < 1) { pixels *= scale; metrics = measure(); }
    if (baseline === 'middle' && Number.isFinite(metrics.actualBoundingBoxAscent)
      && Number.isFinite(metrics.actualBoundingBoxDescent)) {
      y += (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2;
    } else g.textBaseline = baseline;
    g.fillText(label, x, y);
  }

  textBox(value, x, y, w, h, size, color = C.cream, options = {}) {
    const { padding = 0, align = 'center' } = options;
    this.text(value, align === 'left' ? x + padding : align === 'right' ? x + w - padding : x + w / 2,
      y + h / 2, size, color, { ...options, align, max: w - padding * 2, maxHeight: h,
        exactSize: true });
  }

  wrap(value, x, y, width, size, color, leading = size + 7) {
    const g = this.ctx;
    g.font = '400 ' + textSize(size) + 'px ' + (this.uiFont || font);
    let line = '';
    for (const character of value) {
      if (line && g.measureText(line + character).width > width) {
        this.text(line, x, y, size, color, { align: 'left', weight: 400 });
        line = '';
        y += leading;
      }
      line += character;
    }
    if (line) this.text(line, x, y, size, color, { align: 'left', weight: 400 });
    return y + leading;
  }

  cover(image, x, y, w, h, verticalAnchor = .5) {
    if (!image) return;
    const scale = Math.max(w / image.width, h / image.height);
    const sourceW = w / scale;
    const sourceH = h / scale;
    this.ctx.drawImage(image, (image.width - sourceW) / 2, (image.height - sourceH) * verticalAnchor, sourceW, sourceH, x, y, w, h);
  }

  gradient(y, height, first, last) {
    const gradient = this.ctx.createLinearGradient(0, y, 0, y + height);
    gradient.addColorStop(0, first);
    gradient.addColorStop(1, last);
    return gradient;
  }

  hit(x, y, w, h, action, options = {}) {
    if (action && w > 0 && h > 0) this.hits.push({ ...options, x, y, w, h, action });
  }

  hitAt(x, y) {
    for (let i = this.hits.length - 1; i >= 0; i--) {
      const a = this.hits[i];
      if (x >= a.x && x <= a.x + a.w && y >= a.y && y <= a.y + a.h) return a;
    }
    return null;
  }

  actionAt(x, y) { return this.hitAt(x, y)?.action || null; }

  button(value, x, y, w, h, action, variant = 'primary') {
    const colors = {
      primary: ['#D9AA55', '#AA6B29', '#FADE9A', C.light],
      secondary: ['#285C4D', '#0B352D', '#D6B575', C.cream],
      paper: ['#FFF5DE', '#EEDDAD', '#B99552', C.ink],
      danger: ['#BD5740', '#86362C', '#E1B27C', C.light],
      disabled: ['#E1D8BD', '#C9C0A6', '#B3A58B', '#F9F3E2'],
    };
    const [first, last, edge, ink] = colors[action ? variant : 'disabled'];
    const pressed = action && this.pressed && this.pressed.x >= x && this.pressed.x <= x + w
      && this.pressed.y >= y && this.pressed.y <= y + h;
    this.ctx.save();
    if (pressed) {
      this.ctx.translate(x + w / 2, y + h / 2 + 2);
      this.ctx.scale(.98, .98);
      this.ctx.translate(-x - w / 2, -y - h / 2);
    }
    const radius = Math.min(h / 2, 25);
    if(h<=43 && (variant==='secondary'||variant==='paper')) {
      this.choice(value,x,y,w,h,Boolean(action),variant==='secondary');
      this.ctx.restore();this.hit(x,y,w,h,action);return;
    }
    if(this.uiTheme&&action&&variant==='primary'&&w>210&&h>=44){
      this.titleBadge(value,x,y,w,h);this.ctx.restore();this.hit(x,y,w,h,action);return;
    }
    this.box(x, y + 3, w, h, radius, action && variant === 'paper' ? '#B6A075' : '#082A23');
    this.box(x, y, w, h, radius, this.gradient(y, h, first, last), edge, 1.3);
    this.box(x + 3, y + 3, w - 6, h - 6, radius - 3, null, action ? 'rgba(255,239,190,.55)' : 'rgba(255,255,255,.1)', .65);
    const size = h >= 52 ? 27 : h >= 42 ? 23 : 16;
    if (action && variant === 'primary' && w > 260 && h > 50) {
      this.flower(x + 24, y + h / 2, 5, '#FFE6AC');
      this.flower(x + w - 24, y + h / 2, 5, '#FFE6AC');
    }
    this.text(value, x + w / 2, y + h / 2, size, ink, { max: w - 24, maxHeight: h - 16 });
    this.ctx.restore();
    this.hit(x, y, w, h, action);
  }

  icon(value, x, y, action) {
    const key={'‹':'back','≡':'menu','⚙':'settings','×':'close','copy':'copy','share':'share'}[value];
    this.circle(x + 22, y + 24, 19, '#051E19');
    this.circle(x + 22, y + 22, 19, this.gradient(y, 42, '#2B6554', C.pine), C.gold, 1.2);
    this.circle(x + 22, y + 22, 16.5, null, '#70907A', .5);
    this.glyph(value, x + 22, y + 22, 21, C.light);
    this.hit(x, y, 44, 44, action);
  }

  panel(x, y, w, h) {
    this.box(x, y + 4, w, h, 22, 'rgba(0,13,10,.40)');
    this.box(x, y, w, h, 22, this.gradient(y, h, '#FFF4DA', '#F0DFB9'), C.gold, 1.7);
    this.box(x + 4, y + 4, w - 8, h - 8, 18, null, '#FFF9E6', 1.1);
    this.box(x + 7, y + 7, w - 14, h - 14, 15, null, '#D7BF8A', .65);
    const frame=this.assets?.['ui-botanical-frame'];
    if(frame&&h>80){
      this.nine(frame,x-1,y-1,w+2,h+2,.36,.17,w*.36,Math.min(68,h*.23));
    }else if(h>120){
      this.panelCorner(x+7,y+7,1,1);this.panelCorner(x+w-7,y+7,-1,1);
    }
  }

  titleBadge(value,x,y,w,h=39,dark=false){
    const g=this.ctx;
    // A scalloped plaque, with a continuous path rather than stretched bitmap caps.
    const path=(inset)=>{
      const a=x+inset,b=y+inset,ww=w-inset*2,hh=h-inset*2,r=hh*.29;
      g.beginPath();g.moveTo(a+r*1.7,b);g.lineTo(a+ww-r*1.7,b);
      g.quadraticCurveTo(a+ww-r*.8,b,a+ww-r*.8,b+r*.65);
      g.bezierCurveTo(a+ww+r*.2,b+r,a+ww+r*.2,b+hh-r,a+ww-r*.8,b+hh-r*.65);
      g.quadraticCurveTo(a+ww-r*.8,b+hh,a+ww-r*1.7,b+hh);g.lineTo(a+r*1.7,b+hh);
      g.quadraticCurveTo(a+r*.8,b+hh,a+r*.8,b+hh-r*.65);
      g.bezierCurveTo(a-r*.2,b+hh-r,a-r*.2,b+r,a+r*.8,b+r*.65);
      g.quadraticCurveTo(a+r*.8,b,a+r*1.7,b);g.closePath();
    };
    path(0);g.fillStyle=this.gradient(y,h,dark?'#285444':'#D9A34C',dark?'#10382D':'#AA712B');g.fill();g.strokeStyle='#E5BF72';g.lineWidth=1.5;g.stroke();
    path(3);g.strokeStyle='#F7D99A';g.lineWidth=.6;g.stroke();
    if(w>190){this.flower(x+23,y+h/2,4,'#EFC982');this.flower(x+w-23,y+h/2,4,'#EFC982');}
    this.heading(value,x+w/2,y+h/2,Math.min(h>=52?30:25,h*.57),C.light,w-(w>190?58:16));
  }

  choice(value,x,y,w,h,enabled=true,selected=false){
    const r=h/2;
    this.box(x,y+2,w,h,r,'rgba(104,66,15,.22)');
    this.box(x,y,w,h,r,this.gradient(y,h,selected?'#126950':'#FFF4D9',selected?'#064336':'#F2DCAF'),selected?'#C99539':'#BA8A3F',1.1);
    this.box(x+2,y+2,w-4,h-4,r-2,null,selected?'#F9DC8F':'#FFFDF1',.7);
    this.text(value,x+w/2,y+h/2,h>=35?18:16,enabled?(selected?'#FFF1D1':'#49351C'):'#8B8B77',{max:w-14,maxHeight:h-12});
  }

  panelCorner(x,y,sx,sy){
    const g=this.ctx;g.save();g.translate(x,y);g.scale(sx,sy);
    g.beginPath();g.moveTo(0,28);g.bezierCurveTo(0,9,8,0,28,0);g.strokeStyle='#B48538';g.lineWidth=1;g.stroke();
    for(const [cx,cy,a,c] of [[9,18,.65,'#29705A'],[18,8,.65,'#C99A50']]){
      g.save();g.translate(cx,cy);g.rotate(a);g.beginPath();g.ellipse(0,0,4,9,0,0,Math.PI*2);g.fillStyle=c;g.fill();g.strokeStyle='#C39748';g.lineWidth=.7;g.stroke();g.restore();
    }g.restore();
  }

  brand(x,y,w,h){
    if(!this.sprite('ui-brand-mark',x+w*.09,y+h*.09,w*.82,h*.82))this.heading('一起抹车',x+w/2,y+h/2,h*.51,C.cream,w);
  }

  trophy(x,y,size){
    const g=this.ctx;g.save();g.translate(x,y);g.scale(size/50,size/50);
    g.strokeStyle='#E6BD69';g.lineWidth=3;
    for(const side of [-1,1]){
      g.beginPath();g.moveTo(side*17,-17);g.bezierCurveTo(side*34,-23,side*32,4,side*12,5);g.stroke();
    }
    g.fillStyle=this.gradient(-23,37,'#FFE4A0','#B87B27');
    g.beginPath();g.moveTo(-19,-23);g.lineTo(19,-23);g.bezierCurveTo(19,-2,11,10,0,11);g.bezierCurveTo(-11,10,-19,-2,-19,-23);g.fill();
    this.line(-16,-19,16,-19,'#FFF2CB',1.4);
    this.box(-3,10,6,9,1,'#D7A84E');this.box(-15,19,30,5,2,'#E9C477','#93631E',.8);
    this.text('★',0,-6,16,'#FFF2C4');g.restore();
  }

  sectionTitle(label,x,y,w,size=24){
    const room=Math.max(0,(w-label.length*textSize(size)-26)/2);
    this.line(x,y,x+room,y,'#C8A258',.8);this.line(x+w-room,y,x+w,y,'#C8A258',.8);
    this.flower(x+room+7,y,3,C.gold);this.flower(x+w-room-7,y,3,C.gold);
    this.heading(label,x+w/2,y,size,C.cream,w-30);
  }

  heading(value, x, y, size = 24, color = C.light, max = 270) {
    this.text(value, x, y, size, color, { family: this.uiFont || displayFont, max, weight:600 });
  }

  flower(x, y, r, color) {
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      this.circle(x + Math.cos(a) * r * .65, y + Math.sin(a) * r * .65, r * .7, null, color, .8);
    }
    this.circle(x, y, r * .25, color);
  }

  glyph(value, x, y, size, color = C.cream) {
    const g = this.ctx, s = size / 24;
    g.save(); g.translate(x, y); g.scale(s, s);
    g.lineCap = 'round'; g.lineJoin = 'round';
    if (value === '‹') { this.line(3,-8,-5,0,color,2.5); this.line(-5,0,3,8,color,2.5); }
    else if (value === '×') { this.line(-6,-6,6,6,color,2); this.line(-6,6,6,-6,color,2); }
    else if (value === '≡') { for (const dy of [-6,0,6]) this.line(-8,dy,8,dy,color,2); }
    else if (value === '⚙') {
      this.circle(0,0,6,null,color,3); this.circle(0,0,1.5,color);
      for(let i=0;i<8;i++) { const a=i*Math.PI/4; this.line(Math.cos(a)*7,Math.sin(a)*7,Math.cos(a)*10,Math.sin(a)*10,color,3); }
    } else if (value === 'records') {
      [[-8,2,5,8],[-1,-7,5,17],[6,-2,5,12]].forEach(([a,b,c,d])=>this.box(a,b,c,d,1,color));
    } else if (value === 'table') {
      this.box(-10,-8,20,6,3,null,color,1.8); this.line(-6,-2,-8,10,color,1.8); this.line(6,-2,8,10,color,1.8); this.line(-6,4,6,4,color,1.3);
    } else if (value === 'book') {
      this.box(-10,-8,20,17,2,null,color,1.7); this.line(0,-7,0,10,color,1.7);
    } else if(value==='copy'){this.box(-5,-8,13,16,2,null,color,1.6);this.line(-9,-4,-9,10,color,1.6);this.line(-9,10,3,10,color,1.6);}
    else if(value==='share'){this.line(-8,6,7,-7,color,2);this.line(0,-7,7,-7,color,2);this.line(7,-7,7,0,color,2);}
    else this.text(value,0,0,22,color);
    g.restore();
  }

  toggle(enabled, x, y, action) {
    this.box(x, y, 58, 30, 15, enabled ? C.jade : '#A39F89', enabled ? C.gold : '#B2AD97', 1);
    this.circle(x + (enabled ? 43 : 15), y + 15, 11, '#FFF1D3', '#B9A16B', 1);
    this.hit(x - 6, y - 7, 70, 44, action);
  }

  sprite(name, x, y, w, h) {
    const asset = this.assets?.[name];
    if (!asset) return false;
    const scale = Math.min(w / asset.width, h / asset.height);
    this.ctx.drawImage(asset, x + (w - asset.width * scale) / 2, y + (h - asset.height * scale) / 2, asset.width * scale, asset.height * scale);
    return true;
  }

  nine(image,x,y,w,h,sliceX=.15,sliceY=.15,edgeX=32,edgeY=32) {
    if(w<=0||h<=0)return;
    // Rasterize integer-aligned slices once, then transform as one image.
    // Independent subpixel draws on the screen leave antialiasing cracks.
    const sx=[0,Math.round(image.width*sliceX),Math.round(image.width*(1-sliceX)),image.width];
    const sy=[0,Math.round(image.height*sliceY),Math.round(image.height*(1-sliceY)),image.height];
    const scale=2,cw=Math.max(1,Math.round(w*scale)),ch=Math.max(1,Math.round(h*scale));
    this.slices??=new Map();this.imageIds??=new WeakMap();
    if(!this.imageIds.has(image)){
      this.nextImageId=(this.nextImageId||0)+1;
      this.imageIds.set(image,this.nextImageId);
    }
    const key=[this.imageIds.get(image),cw,ch,sliceX,sliceY,edgeX,edgeY].join(':');
    let target=this.slices.get(key);
    if(target){this.slices.delete(key);this.slices.set(key,target);}
    if(!target&&this.createCanvas){
      target=this.createCanvas();target.width=cw;target.height=ch;
      const c=target.getContext('2d'),ex=Math.min(Math.round(edgeX*scale),Math.floor(cw/2)),ey=Math.min(Math.round(edgeY*scale),Math.floor(ch/2));
      const dx=[0,ex,cw-ex,cw],dy=[0,ey,ch-ey,ch];
      for(let row=0;row<3;row++)for(let col=0;col<3;col++)if(dx[col+1]>dx[col]&&dy[row+1]>dy[row])c.drawImage(image,sx[col],sy[row],sx[col+1]-sx[col],sy[row+1]-sy[row],dx[col],dy[row],dx[col+1]-dx[col],dy[row+1]-dy[row]);
      this.slices.set(key,target);
      this.slicePixels=(this.slicePixels||0)+cw*ch;
      while(this.slices.size>20||this.slicePixels>2000000){
        const first=this.slices.keys().next().value,old=this.slices.get(first);
        this.slicePixels-=old.width*old.height;this.slices.delete(first);
      }
    }
    if(target)this.ctx.drawImage(target,x,y,w,h);
    else this.ctx.drawImage(image,x,y,w,h);
  }

  chip(value, x, y, w, hot = false) {
    this.box(x - w / 2, y + 2, w, 31, 15, '#05261F');
    this.box(x - w / 2, y, w, 31, 15, hot ? '#9B3E2E' : this.gradient(y,31,'#FFF1CD','#E8CF98'), hot ? '#E3B877' : C.gold, 1.1);
    this.text(value, x, y + 15, 14, hot ? C.light : C.ink, { max: w - 14 });
  }

  suit(suit, x, y, size, color) {
    // Draw inside a fixed square: phone fallback fonts have different suit
    // ascenders and can overlap the rank even when the desktop glyph fits.
    const g = this.ctx;
    g.save();
    g.translate(x, y);
    g.scale(size, size);
    g.fillStyle = color;
    g.beginPath();
    if (suit === 'diamond') {
      g.moveTo(0, -.5); g.lineTo(.42, 0); g.lineTo(0, .5); g.lineTo(-.42, 0);
    } else if (suit === 'heart') {
      g.moveTo(0, .48);
      g.bezierCurveTo(-.17, .28, -.48, .07, -.48, -.19);
      g.bezierCurveTo(-.48, -.48, -.15, -.56, 0, -.29);
      g.bezierCurveTo(.15, -.56, .48, -.48, .48, -.19);
      g.bezierCurveTo(.48, .07, .17, .28, 0, .48);
    } else if (suit === 'spade') {
      g.moveTo(0, -.5);
      g.bezierCurveTo(-.15, -.28, -.48, -.09, -.48, .14);
      g.bezierCurveTo(-.48, .4, -.16, .43, 0, .22);
      g.bezierCurveTo(.16, .43, .48, .4, .48, .14);
      g.bezierCurveTo(.48, -.09, .15, -.28, 0, -.5);
    } else {
      // The three lobes alone leave a triangular hole above the stem.
      // Fill their junction as part of the same silhouette.
      for (const [cx, cy, radius] of [[0, -.25, .24], [-.24, .08, .24], [.24, .08, .24], [0, .07, .19]]) {
        g.moveTo(cx + radius, cy); g.arc(cx, cy, radius, 0, Math.PI * 2);
        g.closePath();
      }
    }
    g.closePath();
    g.fill();
    if (suit === 'spade' || suit === 'club') {
      g.beginPath();
      g.moveTo(-.07, .12); g.lineTo(.07, .12);
      g.bezierCurveTo(.07, .31, .12, .42, .22, .49);
      g.lineTo(-.22, .49);
      g.bezierCurveTo(-.12, .42, -.07, .31, -.07, .12);
      g.closePath(); g.fill();
    }
    g.restore();
  }

  cardLattice(ctx, x, y, w, h, unit) {
    // One shared 504px weave (~1 MB), cropped in card coordinates. No new
    // canvases or paths per animation frame, and no stretching of the weave.
    if (!this.createCanvas || w > unit*2 || h > unit*2 || !(unit > 0)) {
      paperLattice(ctx,x,y,w,h,unit); return;
    }
    if (!this.latticeTexture && this.latticeFactory !== this.createCanvas) {
      this.latticeFactory = this.createCanvas;
      try {
        const target = this.createCanvas();
        if (!target || target === this.canvas) throw new Error('No offscreen canvas');
        target.width = target.height = 504;
        const g = target.getContext('2d');g.scale(3,3);
        paperLattice(g,0,0,168,168,84);
        this.latticeTexture = target;
      } catch { /* Use the same vector design when offscreen allocation fails. */ }
    }
    if (!this.latticeTexture) { paperLattice(ctx,x,y,w,h,unit); return; }
    const sw=w/unit*252,sh=h/unit*252;
    ctx.drawImage(this.latticeTexture,252-sw/2,252-sh/2,sw,sh,x,y,w,h);
  }

  cardFace(card, x, y, w, h, cache = true) {
    if (!cache || !this.createCanvas || !(w > 0 && h > 0)) {
      drawCardFace(this,card,x,y,w,h); return;
    }
    // Cache by geometry, not position or card id. Reflow and duplicate decks reuse
    // the same face. The pixel budget bounds offscreen memory to about 8 MB.
    const paper = this.assets?.['ui-card-paper'];
    if (!this.cardFaces || this.cardPaper !== paper) {
      this.cardFaces = new Map(); this.cardPixels = 0; this.cardPaper = paper;
    }
    const aspect = Number((h/w).toFixed(5));
    const key = [card.suit,card.rank,Boolean(this.appearance?.largeCards),aspect].join(':');
    let face = this.cardFaces.get(key);
    if (face) { this.cardFaces.delete(key); this.cardFaces.set(key,face); }
    else {
      try {
        const target = this.createCanvas();
        if (!target || target === this.canvas) throw new Error('No offscreen canvas');
        target.width = 252; target.height = Math.ceil(252 * aspect);
        if (target.width * target.height > 2000000) throw new Error('Face exceeds cache budget');
        const painter = new Paint(target);
        painter.assets = this.assets; painter.appearance = this.appearance;
        painter.cardLattice = this.cardLattice.bind(this);
        painter.ctx.scale(3,3);
        drawCardFace(painter,card,0,0,84,84*aspect);
        face = {canvas:target,pixels:target.width*target.height,height:252*aspect};
        this.cardFaces.set(key,face); this.cardPixels += face.pixels;
        while (this.cardFaces.size > 32 || this.cardPixels > 2000000) {
          const oldest = this.cardFaces.keys().next().value;
          this.cardPixels -= this.cardFaces.get(oldest).pixels; this.cardFaces.delete(oldest);
        }
      } catch {
        drawCardFace(this,card,x,y,w,h); return;
      }
    }
    this.ctx.drawImage(face.canvas,0,0,252,face.height,x,y,w,h);
  }

  card(card, x, y, w, h, state = '', cache = true) {
    if (state === 'empty') {
      this.box(x, y, w, h, 10, '#1B4A39', '#6A8E69');
      this.text('◇', x + w / 2, y + h / 2, w * .4, '#608A69');
      return;
    }
    const radius = card ? Math.max(2, Math.min(w,h/1.42) * .084) : 8;
    this.box(x + 1, y + 3, w, h, radius, C.shade);
    if (state === 'selected' || state === 'legal') {
      this.box(x - 2, y - 2, w + 4, h + 4, radius + 2, state === 'selected' ? C.hot : '#F5D583');
    }
    if (!card) {
      this.box(x, y, w, h, radius, this.gradient(y, h, '#FFF2D3', '#EBD3A1'), '#D6BE86', 1);
      const back=this.assets?.['ui-card-back-reference']||this.assets?.cardBack;
      if ((!this.appearance?.cardBack || this.appearance.cardBack === 'flower') && back) {
        this.ctx.save();this.shape(x+1,y+1,w-2,h-2,radius);this.ctx.clip();
        this.ctx.drawImage(back, x + 1, y + 1, w - 2, h - 2);this.ctx.restore();
        return;
      }
      this.box(x + 5, y + 5, w - 10, h - 10, 6, this.appearance?.backColor || '#963A2A', '#EDC581');
      this.box(x + 9, y + 9, w - 18, h - 18, 5, null, '#F5D7A0');
      this.text(this.appearance?.cardBack === 'tea' ? '茶' : this.appearance?.cardBack === 'diamond' ? '◆' : '✿', x + w / 2, y + h / 2, w * .52, C.cream);
      return;
    }
    this.cardFace(card,x,y,w,h,cache);
    if (state === 'blocked') this.box(x, y, w, h, radius, 'rgba(8,40,32,.16)');
  }

  avatarRadius(r){return avatarRadius(r);}

  avatar(image, x, y, r, label, color = C.gold) {
    const g = this.ctx;
    r=avatarRadius(r);
    if(image&&this.assets){const id=Array.from({length:6},(_,i)=>i).find(i=>this.assets['avatar'+i]===image);if(id!==undefined)image=this.assets['ui-portrait-'+id]||image;}
    this.circle(x, y, r + 1.5, C.pine, color, 1.2);
    this.circle(x, y, r - 1, '#B16F46');
    if (image) {
      g.save();
      this.circle(x, y, r - 1);
      g.clip();
      g.drawImage(image, x - r - 1, y - r - 1, (r + 1) * 2, (r + 1) * 2);
      g.restore();
    } else this.text(label, x, y, r * .7, C.light);
  }
}

module.exports = { Paint, C, symbols, ranks };
