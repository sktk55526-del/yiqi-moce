'use strict';

const cloudInitializations = new WeakMap();
function initCloud(cloud, env) {
  let byEnv = cloudInitializations.get(cloud);
  if (!byEnv) { byEnv = new Map(); cloudInitializations.set(cloud, byEnv); }
  if (!byEnv.has(env)) {
    const initialized = Promise.resolve().then(() => cloud.init({ env, traceUser: false }));
    byEnv.set(env, initialized);
    initialized.catch(() => byEnv.delete(env));
  }
  return byEnv.get(env);
}

// Start on a microtask so RoomClient has stored the wrapper before callbacks fire.
function openWeChatSocket(wxApi, config, events) {
  let task = null, ended = false, opened = false;
  const safelyClose = socket => {
    try { socket?.close({ success() {}, fail() {} }); } catch {}
  };
  const finish = (code = 0, reason) => {
    if (ended) return;
    ended = true;
    events.close(code, reason);
  };
  const fail = error => {
    if (ended) return;
    console.warn('[moce socket]', error?.errMsg || error?.message || 'connection failed');
    const socket = task;
    task = null;
    finish(0, config.cloudRun ? '云托管连接失败，请查看控制台中的具体错误。' : undefined);
    if (opened) safelyClose(socket);
  };
  const bind = socket => {
    if (!socket) throw new Error('云托管未返回 SocketTask');
    if (ended) { safelyClose(socket); return; }
    task = socket;
    socket.onOpen(() => { if (!ended && !opened) { opened = true; events.open(); } });
    socket.onMessage(message => { if (!ended) events.message(message.data); });
    socket.onError(fail);
    socket.onClose(event => { task = null; finish(event.code); });
  };
  Promise.resolve().then(async () => {
    if (ended) return;
    if (config.cloudRun) {
      if (typeof wxApi.cloud?.init !== 'function' || typeof wxApi.cloud?.connectContainer !== 'function') {
        finish(0, '当前小游戏环境不支持云托管连接接口，请检查基础库与真机支持。');
        return;
      }
      const { env, service, path = '/socket' } = config.cloudRun;
      await initCloud(wxApi.cloud, env);
      if (ended) return;
      const result = await wxApi.cloud.connectContainer({ config: { env }, service, path });
      bind(result.socketTask);
    } else {
      const socket = wxApi.connectSocket({ url: config.socketUrl, fail });
      // A synchronous failure means this native task never became valid.
      if (!ended) bind(socket);
    }
  }).catch(fail);
  return {
    send(data) {
      if (ended || !opened || !task) throw new Error('连接尚未打开');
      task.send({ data, fail });
    },
    close() {
      if (ended) return;
      ended = true;
      const socket = task;
      task = null;
      safelyClose(socket);
    },
  };
}

module.exports = { openWeChatSocket };
