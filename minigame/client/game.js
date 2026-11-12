'use strict';

const { Paint } = require('./paint');
const { drawScene, WIDTH } = require('./screens');
const { RoomClient } = require('./room-client');
const { startRound, applyMove, roundView, botMove, normalizeOptions, canEat } = require('../shared/rules');
const { dealDuration, playDuration, drawDuration, handLayout } = require('./table-motion');
const { REPORT, MISSED_REPORT, playEffect } = require('./table-effects');
const { MUSIC_CREDITS } = require('./music');
const { createLesson, lessonMove, lessons } = require('./tutorial');
const { chooseMove, DIFFICULTIES } = require('../shared/strategy');
const { RECORD_KEY, readRecords, saveRecord } = require('./records');
const challenges = require('../shared/challenges');
const { reaction, COOLDOWN } = require('../shared/social');
const { themeOf, drawReportCard } = require('./party-screens');
const { normalizeNickname } = require('../shared/nickname');
const { createThemeImages } = require('./themes');
const { loadUiArt } = require('./ui-art');
const { ControlUI } = require('./control-ui');
const { fitViewport } = require('./viewport');

const PREFS = 'moce.prefs.v1';
const practiceNames = ['你', '阿文', '阿曼', '阿杰', '阿乐', '阿欣'];

class Game {
  constructor(platform) {
    this.platform = platform;
    this.paint = new Paint(platform.canvas);
    this.paint.createCanvas = platform.createCanvas;
    this.paint.uiTheme = Boolean(platform.uiImage);
    this.page = 'home';
    this.options = normalizeOptions();
    this.preferences = { music: true, sound: true, vibration: true, reducedMotion: false, reactions: true, voice: 'yue', theme: 'tea', cardBack: 'flower', largeCards: false, ambience: false, ...platform.read(PREFS) };
    this.lastParty = platform.read('moce.last-party.v1') || null;
    this.partyPages = [];
    this.progress = challenges.readProgress(platform.read(challenges.KEY));
    this.reactions = [];
    this.difficulty = DIFFICULTIES.some(d => d.id === this.preferences.difficulty) ? this.preferences.difficulty : 'normal';
    this.records = readRecords(platform.read(RECORD_KEY));
    this.recordMode = 'all';
    this.audioActive = true;
    this.hasInteracted = false;
    this.roomCode = '';
    this.room = null;
    this.practice = null;
    this.selected = null;
    this.suit = null;
    this.images = {};
    this.paint.assets = this.images;
    this.themeImages = createThemeImages(platform, () => this.invalidate());
    this.openingUntil = 0;
    this.effects = [];
    this.effectTimers = new Set();
    this.dealStart = 0;
    this.playMotion = null;
    this.outgoingPlays = [];
    this.drawMotions = [];
    this.handPositions = {};
    this.handPoses = {};
    this.handReflow = null;
    this.handScroll = 0;
    this.rulesScroll = 0;
    this.online = new RoomClient(platform, {
      state: (state, resuming) => this.update(state, resuming),
      status: message => { this.connecting = message; this.invalidate(); },
      busy: value => { this.busy = value; this.invalidate(); },
      error: message => { this.roomConfigSaving = false; if(!this.room&&/房间.*(不存在|结束|关闭)/.test(message)){this.connecting='';this.page='closed';}this.toast(message); },
      ack: type => {
        if (type === 'resume' && this.switchAfterResume) { this.switchAfterResume = false; this.send('release'); }
      },
      closed: message => {
        const intent = this.switchIntent;
        this.switchIntent = null; this.home();
        if (intent && !this.online.session) this.online.enter(intent);
        else if (message) {if(/房间.*(不存在|结束|关闭)/.test(message))this.page='closed';this.toast(message);}
      },
      reaction: event => this.receiveReaction(event),
    });
    this.imageStates = new Map();
    this.loadPageImages();
    this.resize();
    this.fontPending = Boolean(platform.uiFont);
    if (platform.uiFont) platform.uiFont(family => {
      if (family) this.paint.setUiFont(family);
      this.fontPending = false;
      this.invalidate();
    });
  }

  loadPageImages() {
    loadUiArt(this);
    const files = this.page === 'home'
      ? (this.platform.uiImage && this.imageStates.get('ui-home-compact') !== 'failed' ? {} : { hero: 'home-teahouse-v3.jpg', homeLogo: 'home-wordmark-v3.png' })
      : ['table', 'room', 'spectator','result','scores','scoreDetail','records','matchBoard','awards','warReport','party'].includes(this.page)
        ? { ...Object.fromEntries(Array.from({length: 6}, (_, i) => ['avatar' + i, 'portrait-v3-' + i + '.png'])),
          ...(this.page === 'table' ? { cardBack: 'card-back-v3.png' } : {}) } : {};
    for (const [name, file] of Object.entries(files)) {
      if (this.imageStates.has(name)) continue;
      this.imageStates.set(name, 'loading');
      const end = this.platform.profiler?.span('image:' + name);
      this.platform.image(file, image => {
        this.imageStates.set(name, image ? 'ready' : 'failed');
        if (image) this.images[name] = image;
        end?.(image ? 'ready' : 'failed');
        this.invalidate();
      });
    }
  }

  resize() {
    const size = this.platform.size(), { width, height } = size;
    // Webviews can report a transient 1px viewport while being hidden/resized.
    // Preserve the last valid layout until the drawable surface returns.
    const layout = fitViewport(size);
    if (!layout) return;
    const changed = this.scale && ['scale','offset','height','top','bottom'].some(key => this[key] !== layout[key]);
    if(changed){
      // A gesture started in the old viewport must never select a different card
      // after a resize. Render the authoritative hand at its new coordinates.
      this.pointerCancel();this.handReflow=null;this.handPositions={};this.handPoses={};
      this.clearEffects();this.dealStart=0;
    }
    Object.assign(this,layout);
    this.platform.canvas.width = Math.round(width * this.pixelRatio);
    this.platform.canvas.height = Math.round(height * this.pixelRatio);
    this.invalidate();
  }

  invalidate() {
    if (this.framePending || !this.scale) return;
    this.framePending = true;
    this.platform.frame(() => {
      this.framePending = false;
      this.render();
    });
  }

  render() {
    this.loadPageImages();
    const g = this.paint.ctx;
    const canvas = this.platform.canvas;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#041B15';
    g.fillRect(0, 0, canvas.width, canvas.height);
    const s = this.scale * this.pixelRatio;
    g.setTransform(s, 0, 0, s, this.offset * this.pixelRatio, 0);
    g.save();
    this.paint.shape(0, 0, WIDTH, this.height, 0);
    g.clip();
    this.paint.hits = [];
    this.paint.appearance = { ...this.preferences, backColor: themeOf(this.preferences).back };
    this.scrollZone = null;
    const now = Date.now();
    const deadline = this.room?.turnDeadline;
    if (this.audioActive && !this.room?.paused && deadline && this.room.round?.turn === this.room.self && deadline - now - (this.serverOffset || 0) <= 5000 && this.warnedDeadline !== deadline) {
      this.warnedDeadline = deadline;
      if (this.preferences.sound) this.platform.sound('turn-warning');
      if (this.preferences.vibration) this.platform.vibrate();
    }
    this.reactions = this.reactions.filter(r => r.at + 4000 > now);
    this.effects = this.effects.filter(effect => effect.started + effect.duration > now);
    this.drawMotions = this.drawMotions.filter(motion => motion.ends > now);
    this.outgoingPlays = this.outgoingPlays.filter(motion => motion.ends > now);
    drawScene(this, now);
    g.restore();
    this.platform.profiler?.mark('first-paint');
    if (this.paint.hits.length) this.platform.profiler?.mark('input-ready');
    if (this.page === 'home' && this.images.hero && this.images.homeLogo) this.platform.profiler?.mark('home-art-presented');
    this.platform.profiler?.painted();
    if (this.reactions.length && !this.preferences.reducedMotion) this.invalidate();
    clearTimeout(this.clockTimer);
    if (this.audioActive && this.room?.code && (this.room.turnDeadline || this.room.vote || this.room.paused || this.room.players.some(p => !p.online && !p.auto))) {
      this.clockTimer = setTimeout(() => this.invalidate(), 500);
    }
    if (this.page === 'table' && (this.dealUntil > now || this.playMotion?.ends > now || this.outgoingPlays.length
      || this.effects.length || this.drawMotions.length || this.handReflow && now < this.handReflow.started + 190
      || this.openingUntil > now)) this.invalidate();
  }

  get dealUntil() {
    return this.dealStart ? this.dealStart + dealDuration(this.room.players.length) : 0;
  }

  clearEffects() {
    this.playMotion = null;
    this.outgoingPlays = [];
    this.drawMotions = [];
    this.platform.stopSound?.();
    for (const timer of this.effectTimers) clearTimeout(timer);
    this.effectTimers.clear();
    this.effects = [];
  }

  queueEffect(effect, now, started = now, vibrate = false) {
    if (!this.preferences.reducedMotion && this.page === 'table') {
      if (effect.type !== 'report' && effect.type !== 'missed-report') {
        // Keep rapid confirmed stacks individually visible while input stays available.
        for (const prior of this.effects) {
          if (prior.type !== 'report' && prior.type !== 'missed-report') started = Math.max(started, prior.started + 120);
        }
      }
      this.effects.push({ ...effect, started });
    }
    const feedback = () => {
      this.speak(effect.sound);
      if (vibrate && this.preferences.vibration) this.platform.vibrate();
    };
    if (started > now) {
      const timer = setTimeout(() => { this.effectTimers.delete(timer); feedback(); }, started - now);
      this.effectTimers.add(timer);
    } else feedback();
    return started + effect.duration;
  }

  cardFoley(type,count=1,started=Date.now()) {
    const now=Date.now(),total=Math.min(count,8),gap=type==='deal'?108:64;
    for(let i=0;i<total;i++) {
      const play=()=>{if(this.audioActive&&this.preferences.sound)this.platform.cardSound?.(type);};
      const delay=started-now+i*gap;
      if(delay>0){const timer=setTimeout(()=>{this.effectTimers.delete(timer);play();},delay);this.effectTimers.add(timer);}
      else play();
    }
  }

  foreground(invite) {
    if (this.audioActive === false) {
      this.platform.profiler?.resume();
      this.themeImages?.retry();
      for (const [key, state] of this.imageStates || []) if (state === 'failed') this.imageStates.delete(key);
      this.invalidate();
    }
    this.audioActive = true;
    this.syncMusic();
    if (this.tutorial || this.challenge) { this.invalidate(); return; }
    if (this.practice) { this.updatePractice(); return; }
    if (this.online.session) {
      if (!this.online.connected && !this.online.session.parked) this.online.reconnect();
      return;
    }
    if (!this.room && /^\d{6}$/.test(invite || '') && this.page === 'home') {
      this.roomCode = invite;
      this.open('join');
    }
  }

  background() {
    this.controlEntryTaps = null;
    this.platform.profiler?.report();
    if(this.control){this.control.close();if(this.page==='control')this.page='controlLogin';}
    this.cancelNameEdit?.(); this.cancelNameEdit = null;
    this.audioActive = false;
    clearTimeout(this.botTimer);
    clearTimeout(this.clockTimer);
    this.stopReplay?.();
    this.clearEffects();
    // Keep the seat token, but do not trust a socket suspended by the OS.
    // Foreground resumes from the server's authoritative snapshot.
    this.online.disconnect();
    this.syncMusic();
  }

  syncMusic() {
    const enabled = this.audioActive && this.hasInteracted && this.preferences.music;
    this.platform.music(enabled ? (this.room?.round ? 'music-table' : 'music-lobby') : null);
    this.platform.ambient?.(this.audioActive && this.hasInteracted && this.preferences.ambience ? themeOf(this.preferences).ambience : null);
  }

  toast(message) {
    clearTimeout(this.noticeTimer);
    this.notice = message;
    this.invalidate();
    this.noticeTimer = setTimeout(() => { this.notice = ''; this.invalidate(); }, 3300);
  }

  open(page) {
    this.controlEntryTaps = null;
    this.overlay = null;
    if (['rules', 'scores', 'settings'].includes(page)) this.returnPage = this.page;
    if (['rules', 'create', 'roomConfig'].includes(page)) this.rulesScroll = 0;
    this.page = page;
    this.invalidate();
  }

  back() {
    this.controlEntryTaps = null;
    if(['control','controlLogin'].includes(this.page)){this.control.back();return;}
    if (this.page === 'replay') this.stopReplay();
    if (this.overlay) { this.overlay = null; this.switchIntent = null; }
    else if (['party', 'themes', 'matchBoard', 'warReport','awards'].includes(this.page)) {
      this.page = this.partyPages.pop() || (this.room ? this.room.watching ? 'spectator' : this.room.round?.result ? 'result' : this.room.round ? 'table' : 'room' : 'home');
      this.rulesScroll = 0;
    }
    else if (this.connecting) this.cancelConnection();
    else if (this.page === 'scoreDetail') this.page = this.detailReturn || 'result';
    else if (this.page === 'replay') this.page = this.replayReturn || 'result';
    else if (this.page === 'records') this.page = 'home';
    else if (this.page === 'roomConfig') this.page = 'room';
    else if (this.page === 'challenge') { this.openChallenges(); return; }
    else if (this.page === 'tutorial') this.home();
    else if (['rules', 'settings', 'scores'].includes(this.page)) this.page = this.returnPage || 'home';
    else if (this.room) this.overlay = 'leave';
    else this.page = 'home';
    this.invalidate();
  }

  home() {
    this.controlEntryTaps = null;
    this.control?.close();
    this.switchAfterResume = false;
    this.stopReplay();
    clearTimeout(this.botTimer);
    clearTimeout(this.resultTimer);
    clearTimeout(this.clockTimer);
    this.clearEffects();
    this.room = null;
    this.practice = null;
    this.tutorial = null;
    this.challenge = null;
    this.reactions = [];
    clearTimeout(this.reactionTimer);
    this.detailRecord = null;
    this.replayRecord = null;
    this.page = 'home';
    this.returnPage = null;
    this.overlay = null;
    this.selected = null;
    this.partyPages = [];
    this.partyRecord = null;
    this.dealStart = 0;
    this.playMotion = null;
    this.openingUntil = 0;
    this.connecting = '';
    this.syncMusic();
    this.invalidate();
  }

  cancelConnection() {
    this.online.disconnect();
    this.home();
  }

  inputCode(key) {
    this.controlEntryTaps = null;
    if (key === '清空') this.roomCode = '';
    else if (key === '⌫') this.roomCode = this.roomCode.slice(0, -1);
    else if (this.roomCode.length < 6) this.roomCode += key;
    this.invalidate();
  }

  key(key) {
    this.controlEntryTaps = null;
    if (key === 'Escape') { this.back(); return true; }
    if(this.page==='controlLogin')return this.control.key(key);
    if (this.page === 'join' && !this.connecting) {
      if (/^\d$/.test(key)) { this.inputCode(key); return true; }
      if (key === 'Backspace') { this.inputCode('⌫'); return true; }
      if (key === 'Enter' && this.roomCode.length === 6) { this.enterOnline('join'); return true; }
    }
    return false;
  }

  enterOnline(kind) {
    if (this.nameEditing) return;
    const request = kind === 'create' ? { type: 'create', options: { ...this.options } } : { type: 'join', code: this.roomCode };
    try { request.name = normalizeNickname(this.preferences?.nickname || ''); }
    catch (error) { this.toast(error.message); return; }
    if (kind === 'watch') request.type = 'watch';
    if (this.online.session) {
      if (kind !== 'create' && request.code === this.online.session.code) { this.online.reconnect(); return; }
      this.switchIntent = request; this.overlay = 'switchRoom'; this.invalidate(); return;
    }
    this.online.enter(request);
  }

  tapControlTitle(){
    if(this.page!=='join'||this.overlay||this.busy||this.connecting||this.nameEditing){this.controlEntryTaps=null;return;}
    const now=Date.now(),prior=this.controlEntryTaps;
    const count=prior&&now>=prior.at&&now-prior.at<=1000?prior.count+1:1;
    this.controlEntryTaps={at:now,count};
    if(count===5){this.controlEntryTaps=null;this.openControl();}
  }

  openControl(){
    if(this.busy||this.connecting||this.nameEditing)return;
    this.control??=new ControlUI(this);this.control.open();
  }

  editNickname() {
    if (this.busy || this.connecting || this.nameEditing) return;
    if (!this.platform.editName) { this.toast('当前环境不支持名称输入'); return; }
    this.nameEditing = true; this.nameDraft = this.preferences.nickname || '';
    this.cancelNameEdit = this.platform.editName(this.nameDraft, (value, error) => {
      this.nameEditing = false; this.cancelNameEdit = null;
      if (error) this.toast(error);
      else if (value !== null && value !== undefined) {
        try {
          this.preferences.nickname = normalizeNickname(value);
          this.platform.write(PREFS, this.preferences);
          this.toast(this.preferences.nickname ? '名称已保存，加入新桌时使用' : '已恢复默认名称');
        } catch (e) { this.toast(e.message); }
      }
      this.invalidate();
    }, value => { this.nameDraft = value; this.invalidate(); });
    this.invalidate();
  }

  confirmSwitch() {
    this.overlay = null;
    if (this.online.connected) this.send('release');
    else { this.switchAfterResume = true; this.online.reconnect(); }
  }

  openPartyPage(page) {
    this.partyPages.push(this.page); this.page = page; this.rulesScroll = 0;
    this.partyEnteredAt = Date.now(); this.invalidate();
  }

  confirmVote(kind) { this.pendingVote = kind; this.overlay = 'confirmVote'; this.invalidate(); }

  setAppearance(key, value) {
    if (key === 'theme') this.themeImages.retry();
    this.preferences[key] = value; this.platform.write(PREFS, this.preferences); this.syncMusic(); this.invalidate();
  }

  exportReport() {
    const room = this.partyRecord || this.room;
    if (!room?.match) return;
    try {
      const canvas = this.platform.createCanvas?.();
      if (!canvas) { this.toast('当前环境无法导出图片'); return; }
      drawReportCard(canvas, room, themeOf(this.preferences));
      this.platform.exportImage(canvas, ok => this.toast(ok ? '战报图片已生成，可保存分享' : '图片生成失败，请重试'));
    } catch { this.toast('图片生成失败，请重试'); }
  }

  send(type, fields = {}) {
    const sent = this.online.send({ type, rev: this.room?.rev, ...fields });
    if (!sent && !this.busy) this.toast('连接尚未恢复');
  }

  startPractice() {
    this.tutorial = null;
    this.online.disconnect();
    const options = normalizeOptions(this.options);
    this.preferences.difficulty = this.difficulty;
    this.platform.write(PREFS, this.preferences);
    this.practice = { options, difficulty: this.difficulty, round: startRound(options, options.players) };
    this.updatePractice();
  }

  updatePractice() {
    const { options, round } = this.practice;
    this.update({
      code: null, options, self: 0, host: 0,
      players: practiceNames.slice(0, options.players).map((name, avatar) => ({ name, avatar, online: true, ready: true })),
      round: roundView(round, 0),
    });
    clearTimeout(this.botTimer);
    const eater = round.hands.findIndex((_, seat) => seat !== 0 && canEat(round, seat));
    if (!round.result && (round.turn !== 0 || eater >= 0)) {
      const delay = Math.max(canEat(round, 0) ? 1800 : this.practice.difficulty === 'easy' ? 1350 : 850, this.dealUntil - Date.now() + 230);
      this.botTimer = setTimeout(() => {
        if (this.practice?.round !== round || round.result) return;
        const seat = eater >= 0 ? eater : round.turn;
        const random = this.practice.random || Math.random;
        applyMove(round, seat, botMove(round, seat, this.practice.difficulty, random), options, random);
        if (!round.result && round.hands[seat].length === 1 && !round.reported[seat]) {
          applyMove(round, seat, { type: 'report' }, options);
        }
        this.updatePractice();
      }, delay);
    }
  }

  update(state, resuming = false) {
    const resumedConnection=resuming;
    const controlledUpdate=Boolean(state.controlRevision&&this.room&&state.controlRevision!==this.room.controlRevision);
    if(controlledUpdate)resuming=true;
    if (this.switchAfterResume) {
      this.room = state; return;
    }
    if (state.match?.finished && state.round && !state.watching) {
      const id = state.code + ':' + state.round.startedAt;
      if (this.lastParty?.id !== id) {
        this.lastParty = { id, code: state.code, match: JSON.parse(JSON.stringify(state.match)) };
        this.platform.write('moce.last-party.v1', this.lastParty);
      }
    }
    if (state.ended) {
      clearTimeout(this.resultTimer); this.room = state;
      if (!['matchBoard', 'warReport', 'themes'].includes(this.page)) this.page = 'matchBoard';
      this.overlay = null; this.clearEffects(); this.invalidate(); return;
    }
    if (state.watching) {
      this.room = state;
      if (!['party', 'themes', 'matchBoard', 'warReport', 'scores', 'scoreDetail'].includes(this.page)) this.page = 'spectator';
      this.invalidate(); return;
    }
    if (this.room?.watching) { this.page = 'table'; this.partyPages = []; this.toast('候补入座成功，本局由你出牌'); }
    const previousOptions = this.room?.options;
    if (state.round?.result) {
      if (this.practice?.date && !this.practice.recorded) {
        this.practice.recorded = true;
        const date = this.practice.date, delta = state.round.result.deltas[state.self];
        const old = this.progress.days[date];
        this.progress.days[date] = { attempts: (old?.attempts || 0) + 1, best: Math.max(old?.best ?? -Infinity, delta), won: old?.won || state.round.result.winner === state.self };
        this.saveProgress();
      }
      const records = saveRecord(this.records, state, this.practice?.difficulty || 'normal');
      if (records !== this.records) { this.records = records; this.platform.write(RECORD_KEY, records); }
    }
    if (state.serverTime) this.serverOffset = state.serverTime - Date.now();
    const previous = this.room?.round;
    const next = state.round;
    const differentRound = !previous || previous.number !== next?.number;
    const moved = previous && next && !differentRound && previous.step !== next.step;
    const init = !this.room;
    const now = Date.now();
    const animatedEvent = !resuming && moved && next.step === previous.step + 1
      && ['play', 'eat'].includes(next.event.type);
    const drawEvents = next ? [ ...(next.event.type === 'draw' ? [next.event] : []),
      ...(next.event.reportPenalties || []) ].filter(event => event.count > 0) : [];
    const animatedDraw = !resuming && moved && next.step === previous.step + 1
      && drawEvents.length > 0
      && !this.preferences.reducedMotion && this.page === 'table';
    const drawStart = Math.max(now, this.playMotion?.ends || 0);
    const effect = animatedEvent ? playEffect(next.event) : null;
    if (differentRound || resuming) this.clearEffects();
    if (differentRound || resuming || this.preferences.reducedMotion) {
      this.handReflow = null;
      this.handPositions = {};
      this.handPoses = {};
    } else if (moved && previous.hand.map(c => c.id).join() !== next.hand.map(c => c.id).join()) {
      this.handReflow = { started: now, poses: { ...this.handPoses } };
    }
    if (differentRound || moved || resuming) {
      this.dealStart = 0;
      this.openingUntil = 0;
    }
    this.outgoingPlays = (this.outgoingPlays || []).filter(motion => motion.ends > now);
    if (this.preferences.reducedMotion) { this.playMotion = null; this.outgoingPlays = []; }
    if (animatedEvent && !this.preferences.reducedMotion && this.page === 'table') {
      const { seat, cards, card } = next.event;
      const played = cards || [card];
      // Rapid authoritative plays may overlap visually. A report/draw update
      // must not erase a card that is still in flight.
      if (this.playMotion?.ends > now) this.outgoingPlays.push(this.playMotion);
      this.playMotion = { started: now, ends: now + playDuration(played.length), seat, cards: played,
        previousTop: previous.top, hand: previous.hand, handScroll: this.handScroll,
        selected: this.selected, handPositions: { ...this.handPositions }, handPoses: { ...this.handPoses } };
      this.cardFoley('play');
    }
    let drawEnd = 0;
    if (animatedDraw) {
      drawEvents.forEach((event, index) => {
        const { seat, count, requested, recycled, reason } = event;
        const cards = seat === state.self ? next.hand.slice(-count) : [];
        if (seat === state.self) this.handScroll = handLayout(next.hand.length, 0).max;
        const started = Math.max(drawStart, reason === 'missed-report' ? (this.playMotion?.ends || now) + 330 : now) + index * 100;
        const ends = started + drawDuration(count);
        drawEnd = Math.max(drawEnd, ends);
        this.drawMotions.push({ started, ends, seat, count, requested, recycled, reason, cards });
        this.cardFoley('draw',count,started);
      });
    }
    const effectEnd = effect ? this.queueEffect(effect, now, this.playMotion?.ends ?? now,
      effect.type === 'penalty' && !next.result && next.turn === state.self) : 0;
    let missedEnd = 0;
    if (!resuming && moved && next.step === previous.step + 1) {
      for (const penalty of next.event.reportPenalties || []) {
        if (!penalty.count) continue;
        const drawAt = this.drawMotions.find(m => m.reason === 'missed-report' && m.seat === penalty.seat && m.started >= now)?.started;
        const started = drawAt ? drawAt-250 : (this.playMotion?.ends || now)+80;
        missedEnd = Math.max(missedEnd, this.queueEffect({ ...MISSED_REPORT, seat: penalty.seat }, now, started,
          penalty.seat === state.self));
      }
    }
    const settleAt = Math.max(drawEnd, this.preferences.reducedMotion ? 0 : missedEnd,
      this.playMotion ? (effectEnd || this.playMotion.ends + 70) : 0);
    const delayResult = (animatedEvent || animatedDraw) && next.result && settleAt > now;
    this.room = state;
    if (resumedConnection) this.toast(state.players[state.self].returnNextRound ? '已返回牌局 · 本局电脑代打，下一局恢复操作' : '已恢复原座位与牌局');
    if (Boolean(previous) !== Boolean(next)) this.syncMusic();
    if (differentRound || moved) {
      this.selected = null;
      this.suit = null;
      if (this.overlay === 'suit') this.overlay = null;
    }
    if (!next) {
      const keepPage = ['party', 'themes', 'matchBoard', 'warReport'].includes(this.page)
        || this.page === 'roomConfig' && state.self === state.host;
      if (!keepPage) this.page = 'room';
      if (previous || this.roomConfigSaving) { this.page = 'room'; this.roomConfigSaving = false; }
      if (previousOptions && JSON.stringify(previousOptions) !== JSON.stringify(state.options)) this.toast('玩法已更新，请重新准备');
    }
    else if (differentRound || next.result && !previous?.result || init || this.page === 'room') {
      this.page = next.result && !delayResult ? 'result' : 'table';
      this.returnPage = null;
      this.overlay = null;
      if (differentRound) {
        this.handScroll = 0;
        if (!resuming && next.step === 0 && !next.result && !this.preferences.reducedMotion) {this.dealStart = now;this.cardFoley('deal',8,now);}
        this.openingUntil = !resuming && next.step === 0 && next.opening
          ? Math.max(now, this.dealUntil) + 850 : 0;
      }
    }
    if (!differentRound && !resuming && next) {
      next.reported?.forEach((reported, seat) => {
        if (reported && !previous.reported?.[seat]) this.queueEffect({ ...REPORT, seat }, now);
      });
    }
    if (delayResult) {
      this.resultTimer = setTimeout(() => {
        if (this.room?.round?.number === next.number && this.room.round.result) {
          this.page = 'result';
          this.returnPage = null;
          this.overlay = null;
          this.invalidate();
        }
      }, settleAt - now);
    }
    this.invalidate();
  }

  select(cardId) {
    if (this.room?.round?.legal.includes(cardId)) this.selected = this.selected === cardId ? null : cardId;
    this.invalidate();
  }

  playSelected() {
    const card = this.room?.round?.hand.find(item => item.id === this.selected);
    if (!card || !this.room.round.legal.includes(card.id)) return;
    if (card.rank === 8) { this.overlay = 'suit'; this.suit = null; this.invalidate(); }
    else this.move({ type: 'play', cardId: card.id });
  }

  confirmSuit() {
    if (!this.selected || !this.suit) return;
    const move = { type: 'play', cardId: this.selected, suit: this.suit };
    this.overlay = null;
    this.move(move);
  }

  draw() { this.move({ type: 'draw' }); }

  eat() { this.move({ type: 'eat' }); }

  report() { this.move({ type: 'report' }); }

  move(move) {
    if (this.room?.watching || this.room?.paused || this.room?.ended) { this.toast('当前只能观看牌局'); return; }
    if (Date.now() < this.dealUntil) return;
    if (Date.now() < (this.moveLockedUntil || 0)) return;
    if (this.room?.players[this.room.self]?.returnNextRound) { this.toast('本局由电脑代打，下一局才能恢复操作'); return; }
    if (this.room?.players[this.room.self]?.auto) { this.toast('点击上方「接管」后再出牌'); return; }
    if (this.challenge) {
      try {
        challenges.challengeMove(this.challenge, move);
        this.selected = null;
        this.room.round = roundView(this.challenge.round, 0);
        if (move.type === 'report') this.speak('report');
        else { const effect = playEffect(this.challenge.log[0]); if (effect) this.speak(effect.sound); }
        if (this.challenge.complete) {
          const id = this.challenge.definition.id, stars = this.challenge.hinted ? 2 : 3;
          this.progress.puzzles[id] = { stars: Math.max(stars, this.progress.puzzles[id]?.stars || 0) };
          this.saveProgress();
        }
      } catch (error) { this.toast(error.message); }
    } else if (this.tutorial) {
      try {
        lessonMove(this.tutorial, move);
        this.selected = null;
        this.room.round = roundView(this.tutorial.round, 0);
        if (this.preferences.sound && move.type === 'report') this.speak(REPORT.sound);
        else if (this.preferences.sound) {
          const effect = playEffect(this.tutorial.round.event);
          if (effect) this.speak(effect.sound);
        }
        this.invalidate();
      } catch (error) { this.toast(error.message); }
    } else if (this.practice) {
      const { round, options } = this.practice;
      try { applyMove(round, 0, move, options, this.practice.random || Math.random); this.moveLockedUntil = Date.now() + 180; this.updatePractice(); }
      catch (error) { this.toast(error.message); }
    } else this.send('move', { move });
    this.invalidate();
  }

  next() {
    if (this.practice?.date) { this.startDaily(this.practice.date); }
    else if (this.practice) {
      const { options, round } = this.practice;
      this.practice.round = startRound(options, round.hands.length, round);
      this.updatePractice();
    } else this.send('next', { roundNumber: this.room.round.number });
  }

  startTutorial(index = 0) {
    this.home();
    this.tutorial = createLesson(index);
    this.room = { code: null, self: 0, host: 0, options: this.tutorial.options,
      players: [{ name: '你', avatar: 0, online: true }, { name: '教学搭档', avatar: 1, online: true }],
      round: roundView(this.tutorial.round, 0) };
    this.page = 'tutorial';
    this.invalidate();
  }

  nextLesson() {
    if (this.tutorial.index + 1 < lessons.length) this.startTutorial(this.tutorial.index + 1);
    else { this.home(); this.open('practice'); }
  }

  hint() {
    const round = this.room?.round;
    if (!round || round.result) return;
    if (round.hand.length === 1 && !round.reported[this.room.self]) { this.toast('先报牌，再出最后一张'); return; }
    if (round.canEat) { this.toast('整手牌合计相等，点「吃牌」即可获胜'); return; }
    if (round.turn !== this.room.self) { this.toast('还未轮到你，可先看看自己的手牌'); return; }
    const suggestion = chooseMove(round, this.room.self, 'hard');
    this.selected = suggestion.cardId || null;
    if (this.selected) {
      const index = round.hand.findIndex(card => card.id === this.selected);
      const layout = handLayout(round.hand.length, 0);
      this.handScroll = Math.max(0, Math.min(layout.max, layout.gap * (index - Math.floor(layout.visible / 2))));
      this.handReflow = null;
    }
    this.toast(this.selected ? '已选中可出的牌，确认后点「出牌」' : '没有可出的牌，请摸牌');
  }

  toggleAuto() {
    if (this.room.players[this.room.self].returnNextRound) { this.toast('本局由电脑代打，下一局才能恢复操作'); return; }
    this.send('auto', { enabled: !this.room.players[this.room.self].auto });
  }

  manage(seat) {
    this.manageSeat = seat;
    this.manageRev = this.room.rev;
    this.overlay = 'manage';
    this.invalidate();
  }

  confirmManage(action) {
    if (this.manageRev !== this.room.rev) { this.overlay = null; this.toast('房间已更新，请重新选择玩家'); return; }
    this.overlay = null;
    this.send('manage', { action, seat: this.manageSeat });
  }

  scoreDetail(seat) {
    this.detailRecord = this.page === 'replay' ? this.replayRecord : null;
    this.stopReplay();
    this.detailSeat = seat;
    this.detailReturn = this.page;
    this.rulesScroll = 0;
    this.page = 'scoreDetail';
    this.invalidate();
  }

  editRoomOptions() {
    if (this.room?.round || this.room?.self !== this.room?.host) return;
    this.roomDraft = { ...this.room.options };
    this.roomDraftRev = this.room.rev;
    this.page = 'roomConfig';
    this.invalidate();
  }

  saveRoomOptions() {
    if (this.roomDraftRev !== this.room.rev) { this.page = 'room'; this.toast('房间已变化，请重新打开玩法设置'); return; }
    this.roomConfigSaving = true;
    this.send('options', { options: this.roomDraft });
  }

  openRecords() { this.recordMode = 'all'; this.rulesScroll = 0; this.open('records'); }

  clearRecords() {
    this.records = [];
    this.platform.write(RECORD_KEY, []);
    this.rulesScroll = 0;
    this.overlay = null;
    this.invalidate();
  }

  openReplay(record = null) {
    this.replayReturn = this.page;
    if (!record) {
      const round = this.room?.round;
      if (!round?.result) return;
      record = { ...round, self: this.room.self, players: this.room.players.map(p => ({ name: p.name, avatar: p.avatar })) };
    }
    this.replayRecord = record;
    this.replayIndex = 0;
    this.page = 'replay';
    this.invalidate();
  }

  stopReplay() { clearTimeout(this.replayTimer); this.replayPlaying = false; }

  replayStep(delta) {
    this.stopReplay();
    this.replayIndex = Math.max(0, Math.min(this.replayRecord.history.length - 1, this.replayIndex + delta));
    this.invalidate();
  }

  toggleReplay() {
    if (this.replayPlaying) { this.stopReplay(); this.invalidate(); return; }
    if (this.replayIndex >= this.replayRecord.history.length - 1) this.replayIndex = 0;
    this.replayPlaying = true;
    const tick = () => {
      if (this.page !== 'replay' || !this.audioActive) { this.stopReplay(); return; }
      if (this.replayIndex < this.replayRecord.history.length - 1) this.replayIndex++;
      else { this.stopReplay(); this.invalidate(); return; }
      this.invalidate();
      this.replayTimer = setTimeout(tick, 1100);
    };
    this.replayTimer = setTimeout(tick, 1100);
    this.invalidate();
  }

  toggle(key) {
    this.preferences[key] = !this.preferences[key];
    this.platform.write(PREFS, this.preferences);
    if (key === 'music' || key === 'ambience') this.syncMusic();
    if (key === 'sound' && !this.preferences.sound) this.platform.stopSound?.();
    if (key === 'reactions' && !this.preferences.reactions) { this.reactions = []; this.platform.stopSound?.(); }
    if (key === 'reducedMotion' && this.preferences[key]) {
      this.effects = [];
      this.dealStart = 0;
      this.playMotion = null;
      this.outgoingPlays = [];
      this.drawMotions = [];
      this.handReflow = null;
    }
    this.invalidate();
  }

  leave() {
    if (this.practice || this.tutorial || this.challenge) this.home();
    else if (this.online.connected) {
      this.overlay = null;
      this.send('leave');
    } else this.cancelConnection();
    this.invalidate();
  }

  saveProgress() {
    this.progress = challenges.readProgress(this.progress);
    this.platform.write(challenges.KEY, this.progress);
  }

  openChallenges() { this.home(); this.rulesScroll = 0; this.open('challenges'); }

  startChallenge(id) {
    this.home();
    this.challenge = challenges.createChallenge(id);
    this.room = { code: null, self: 0, host: 0, options: this.challenge.options,
      players: [{ name: '你', avatar: 0, online: true }, { name: '残局搭档', avatar: 1, online: true }],
      round: roundView(this.challenge.round, 0) };
    this.page = 'challenge'; this.syncMusic(); this.invalidate();
  }

  challengeHint() { this.challenge.hinted = true; this.toast(this.challenge.definition.hint); }

  startDaily(date = challenges.dayKey()) {
    this.home(); this.online.disconnect();
    this.practice = challenges.dailyRound(date);
    this.updatePractice();
  }

  speak(type, social = false) {
    if (!this.preferences.sound || !this.audioActive) return;
    if (social && !this.preferences.reactions) return;
    const name = this.preferences.voice === 'yue' ? 'yue-' + type : social ? 'social-' + type : type;
    this.platform.sound(name, social);
  }

  setVoice(value) {
    if (!['yue', 'mandarin'].includes(value)) return;
    this.preferences.voice = value;
    this.platform.write(PREFS, this.preferences);
    this.platform.stopSound?.();
    this.speak('report'); this.invalidate();
  }

  openSocial() {
    if (!this.preferences.reactions) { this.toast('互动已静音，可在设置中开启'); return; }
    this.overlay = 'social'; this.invalidate();
  }

  sendReaction(id) {
    if (!reaction(id) || !this.room || !this.preferences.reactions) return;
    const now = Date.now();
    if (now < (this.reactionUntil || 0)) { this.toast('歇一歇，6 秒后再发送'); return; }
    if (this.room.code) {
      if (this.busy || !this.online.connected) { this.toast('连接尚未恢复'); return; }
      if (!this.online.send({ type: 'reaction', reaction: id })) return;
    } else this.receiveReaction({ seat: this.room.self, reaction: id });
    this.reactionUntil = now + COOLDOWN;
    this.overlay = null; this.invalidate();
  }

  receiveReaction(event) {
    if (!this.room || !this.preferences.reactions || !this.audioActive || !reaction(event.reaction)
      || !Number.isInteger(event.seat) || !this.room.players[event.seat]) return;
    this.reactions = this.reactions.filter(r => r.seat !== event.seat && r.at + 4000 > Date.now());
    this.reactions.push({ seat: event.seat, id: event.reaction, at: Date.now() });
    this.speak(event.reaction, true);
    clearTimeout(this.reactionTimer);
    this.reactionTimer = setTimeout(() => this.invalidate(), 4100);
    this.invalidate();
  }

  inviteCode() { return this.room?.code || ''; }
  inviteTitle() {
    const state = this.room;
    return state?.code ? '一起抹车 · ' + state.players.length + '/' + state.options.players + '人 · ' + state.options.decks
      + '副牌 · ' + (state.options.exhaustion === 'draw' ? '流局模式' : '洗牌继续') + ' · 房间' + state.code : '一起抹车 · 广东纸牌';
  }
  share() { if (this.inviteCode()) this.platform.share(this.inviteCode(), this.inviteTitle()); }
  copyCode() {
    if (this.inviteCode()) this.platform.copy(this.inviteCode(), ok => { if (ok) this.toast('房间号已复制'); });
  }

  copyMusicCredits() {
    this.platform.copy(MUSIC_CREDITS, ok => { if (ok) this.toast('音乐署名已复制'); });
  }

  logical(point) { return { x: (point.x - this.offset) / this.scale, y: point.y / this.scale }; }

  scrollHand(direction) {
    const layout = handLayout(this.room?.round?.hand.length || 0, this.handScroll);
    const page = layout.pageStep ? (direction > 0 ? Math.floor(layout.offset / layout.pageStep + 1e-7) + 1
      : Math.ceil(layout.offset / layout.pageStep - 1e-7) - 1) : 0;
    this.handScroll = Math.max(0, Math.min(layout.max, page * layout.pageStep));
    this.handReflow = null;
    this.invalidate();
  }

  pointerDown(point) {
    const p = this.logical(point);
    const silent = this.paint.hitAt(p.x,p.y)?.silent;
    this.paint.pressed = silent ? null : p;
    if(!silent)this.invalidate();
    const zone = this.scrollZone;
    const inZone = !this.overlay && !this.connecting && zone && p.x >= zone.x && p.x <= zone.x + zone.w
      && p.y >= zone.y && p.y <= zone.y + zone.h;
    this.gesture = { p, zone: inZone ? zone : null, hand: this.handScroll, rules: this.rulesScroll, moved: false,
      page: this.page, overlay: this.overlay, rev: this.room?.rev, step: this.room?.round?.step };
  }

  pointerMove(point) {
    if (!this.gesture) return;
    const g = this.gesture;
    const p = this.logical(point);
    const dx = p.x - g.p.x, dy = p.y - g.p.y;
    g.moved ||= Math.abs(dx) > 8 || Math.abs(dy) > 8;
    if(g.moved)this.controlEntryTaps=null;
    if (g.moved && this.paint.pressed) { this.paint.pressed = null; this.invalidate(); }
    if (g.moved && g.zone?.type === 'hand') {
      this.handScroll = Math.max(0, Math.min(g.zone.max, g.hand - dx));
      this.handReflow = null;
    }
    if (g.moved && g.zone?.type === 'rules') this.rulesScroll = Math.max(0, Math.min(g.zone.max, g.rules - dy));
    if (g.moved && g.zone) this.invalidate();
  }

  pointerUp(point) {
    if (!this.gesture) return;
    this.pointerMove(point);
    const g = this.gesture;
    this.gesture = null;
    this.paint.pressed = null;
    if (g.moved && g.zone?.type === 'hand') {
      const layout = handLayout(this.room?.round?.hand.length || 0, this.handScroll);
      // Stop on a whole corner index, including the last complete card.
      this.handScroll = layout.max ? Math.min(layout.max, Math.round(layout.offset / layout.gap) * layout.gap) : 0;
    }
    this.invalidate();
    if (g.moved || g.page !== this.page || g.overlay !== this.overlay || g.rev !== this.room?.rev || g.step !== this.room?.round?.step) return;
    const { x, y } = this.logical(point);
    const hit = this.paint.hitAt(x, y);
    if(!hit?.controlEntry)this.controlEntryTaps=null;
    if(hit?.silent){hit.action();return;}
    this.platform.profiler?.mark('first-interaction');
    this.hasInteracted = true;
    if (hit) { hit.action(); this.invalidate(); }
    this.syncMusic();
  }

  pointerCancel() { this.controlEntryTaps = null; this.gesture = null; this.paint.pressed = null; this.invalidate(); }

  wheel(delta) {
    if (this.overlay || this.connecting || !this.scrollZone) return;
    const property = this.scrollZone.type === 'hand' ? 'handScroll' : 'rulesScroll';
    this[property] = Math.max(0, Math.min(this.scrollZone.max, this[property] + delta / this.scale));
    if (property === 'handScroll') this.handReflow = null;
    this.invalidate();
  }
}

module.exports = { Game };
