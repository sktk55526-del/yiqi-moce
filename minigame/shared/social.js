'use strict';
const { clips } = require('./cantonese');
const COOLDOWN = 6000;
const REACTIONS = [
  { id: 'hello', icon: '茶', text: clips.hello.replace(/。$/, ''), mandarin: '喝口茶，慢慢来', color: '#E7C778' },
  { id: 'nice', icon: '赞', text: clips.nice, mandarin: '好牌！', color: '#A8D6AA' },
  { id: 'wow', icon: '哇', text: clips.wow, mandarin: '厉害！', color: '#F4BC75' },
  { id: 'think', icon: '想', text: clips.think.replace(/。$/, ''), mandarin: '让我想一下', color: '#B3CBE8' },
  { id: 'luck', icon: '运', text: clips.luck, mandarin: '好运来了！', color: '#F5BEAF' },
  { id: 'again', icon: '再', text: clips.again, mandarin: '再来一局！', color: '#D9B9E0' },
];
const reaction = id => REACTIONS.find(item => item.id === id);
module.exports = { COOLDOWN, REACTIONS, reaction };
