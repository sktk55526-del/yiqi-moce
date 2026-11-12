'use strict';

const SESSION_KEY = 'moce.room.v1';
const { PROTOCOL } = require('../shared/party');

class RoomClient {
  constructor(platform, events) {
    this.platform = platform;
    this.events = events;
    this.session = platform.read(SESSION_KEY) || null;
    this.socket = null;
    this.connected = false;
    this.pending = null;
    this.retry = null;
    this.sequence = 0;
    this.attempts = 0;
  }

  setSession(session) {
    this.session = session;
    this.platform.write(SESSION_KEY, session);
  }

  open(intent) {
    if (this.platform.isOnline?.() === false) {
      this.events.status(this.session && !this.session.parked ? '网络已断开，恢复后自动重连' : '');
      if (!this.session) this.events.error('当前没有网络，联网后再加入好友房');
      return;
    }
    if (!this.platform.socketUrl && !this.platform.cloudRun) {
      this.events.error('好友房需要配置联机服务器地址，可先玩人机练习。');
      return;
    }
    if (this.socket) return;
    this.connectMeasurement = this.platform.profiler?.span(this.session ? 'reconnect-to-state' : 'connect-to-state');
    this.events.status(this.session ? '正在恢复牌桌…' : '正在连接…');
    const handlers = {
      open: () => {
        if (this.socket !== socket) return;
        this.connected = true;
        clearTimeout(this.retry);
        const request = this.session ? { type: 'resume', ...this.session } : intent;
        if (request) this.send(request);
      },
      message: raw => {
        if (this.socket !== socket) return;
        let data;
        try { data = JSON.parse(raw); } catch { return; }
        this.receive(data);
      },
      close: (code, reason) => {
        if (this.socket !== socket) return;
        this.connectMeasurement?.('closed');
        this.socket = null;
        this.connected = false;
        this.clearPending();
        if (code === 4001) {
          this.setSession(null);
          this.events.closed('此座位已在另一端恢复');
          this.events.status('');
          return;
        }
        if (!this.session) {
          this.events.status('');
          this.events.error(reason || '连不上好友房服务器，请稍后重试。');
          return;
        }
        this.events.status('连接中断，正在恢复牌桌…');
        this.schedule();
      },
    };
    let socket;
    try { socket = this.platform.openSocket(handlers); } catch {
      this.connectMeasurement?.('failed');
      this.events.status('');
      this.events.error('无法连接好友房服务器');
      if (this.session) this.schedule();
      return;
    }
    this.socket = socket;
    clearTimeout(this.retry);
    this.retry = setTimeout(() => {
      if (!this.connected && this.socket === socket) {
        try { socket.close(); } catch {}
        handlers.close(0);
      }
    }, this.platform.socketTimeout || 7000);
  }

  schedule() {
    clearTimeout(this.retry);
    this.retry = setTimeout(() => this.open(), Math.min(6000, 600 * 2 ** this.attempts++));
  }

  clearPending() {
    if (this.pending) clearTimeout(this.pending.timer);
    this.pending = null;
    this.events.busy(false);
  }

  send(message) {
    if (!this.connected || this.pending) return false;
    const id = ++this.sequence;
    const timer = setTimeout(() => {
      this.clearPending();
      if (this.session) {
        this.events.status('响应超时，正在恢复牌桌…');
        const socket = this.socket;
        this.socket = null;
        this.connected = false;
        if (socket) { try { socket.close(); } catch {} }
        this.schedule();
      } else {
        this.events.status('');
        this.events.error('响应超时，请重试。');
        this.disconnect();
      }
    }, 6500);
    this.pending = { id, timer, type: message.type };
    this.events.busy(true);
    try { this.socket.send(JSON.stringify({ ...message, protocol: PROTOCOL, id })); } catch {
      this.clearPending();
      this.events.error('连接已中断，请重新连接。');
      const socket = this.socket;
      this.socket = null;
      this.connected = false;
      if (socket) { try { socket.close(); } catch {} }
      if (this.session) this.schedule();
      else this.events.status('');
      return false;
    }
    return true;
  }

  receive(data) {
    if (data.type === 'session') {
      this.setSession({ code: data.code, token: data.token });
    } else if (data.type === 'state') {
      if (data.state.protocol !== PROTOCOL) {
        if (this.session) this.setSession({ ...this.session, parked: true });
        this.disconnect(); this.events.status('');
        this.events.closed('服务端版本不兼容，请同步更新云托管与体验版'); return;
      }
      this.attempts = 0;
      this.connectMeasurement?.('ready');
      this.events.status('');
      this.events.state(data.state, this.pending?.type === 'resume');
    } else if (data.type === 'reaction') {
      this.events.reaction?.(data);
    } else if (data.type === 'notice') {
      this.events.error(data.message);
    } else if (data.type === 'room-left' && data.resumable && this.session) {
      this.setSession({ ...this.session, parked: true });
      this.disconnect();
      this.events.status('');
      this.events.closed('座位已保留，可返回观看，下一局恢复操作');
    } else if (data.type === 'room-closed') {
      this.setSession(null);
      this.disconnect();
      this.events.status('');
      this.events.closed(data.reason);
    } else if (data.type === 'ack' || data.type === 'error') {
      const completedType = this.pending?.id === data.id ? this.pending.type : null;
      if (this.pending?.id === data.id) this.clearPending();
      if (data.type === 'ack' && completedType) this.events.ack?.(completedType);
      if (data.type === 'error') {
        if (data.code === 'incompatible') {
          if (this.session) this.setSession({ ...this.session, parked: true });
          this.disconnect(); this.events.status(''); this.events.closed(data.message); return;
        }
        if (data.code === 'no-room' || data.code === 'no-seat') {
          const wasInRoom = Boolean(this.session);
          this.setSession(null);
          this.disconnect();
          this.events.status('');
          this.events.error(data.message);
          if (wasInRoom) this.events.closed('');
          return;
        }
        this.events.status('');
        this.events.error(data.message);
        if (!this.session) this.disconnect();
      }
    }
  }

  enter(intent) {
    if (!this.socket) this.open(intent);
    else if (this.connected) this.send(intent);
  }

  reconnect() {
    if (!this.session || this.connected) return;
    clearTimeout(this.retry);
    if (this.socket) return;
    this.attempts = 0;
    this.open();
  }

  disconnect(forget = false) {
    this.connectMeasurement?.('cancelled'); this.connectMeasurement = null;
    clearTimeout(this.retry);
    this.clearPending();
    const socket = this.socket;
    this.socket = null;
    this.connected = false;
    if (socket) { try { socket.close(); } catch {} }
    if (forget) this.setSession(null);
  }
}

module.exports = { RoomClient };
