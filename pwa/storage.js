'use strict';
const SESSION = 'moce.room.v1', OWNER = 'moce.pwa.owner';
function createStorage(storage, id, onFailure = () => {}) {
  const memory = new Map();
  try { storage.setItem(OWNER, id); } catch {}
  return {
    read(key) { try { const value = JSON.parse(storage.getItem(key)); memory.set(key,value); return value; } catch { return memory.get(key) ?? null; } },
    write(key, value) {
      memory.set(key, value);
      try {
        // A superseded tab must not delete the seat saved by the new tab.
        if (key === SESSION) {
          if (!value && storage.getItem(OWNER) !== id) return;
          if (value) storage.setItem(OWNER, id);
        }
        if (value === null) storage.removeItem(key); else storage.setItem(key, JSON.stringify(value));
      } catch { onFailure(); }
    },
  };
}
module.exports = { createStorage };
