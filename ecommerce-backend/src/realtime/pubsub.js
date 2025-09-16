const { EventEmitter } = require('events');

const emitter = new EventEmitter();
emitter.setMaxListeners(0); // unlimited listeners

const DEBOUNCE_MS = 50;
const pending = new Map(); // productId -> { last }

function publishStockChange(payload) {
  if (!payload || !payload.productId) return;
  const key = String(payload.productId);
  const existing = pending.get(key);
  if (existing) {
    existing.last = payload;
    return;
  }
  pending.set(key, { last: payload });
  setTimeout(() => {
    const item = pending.get(key);
    pending.delete(key);
    if (item && item.last) {
      emitter.emit('stock.changed', item.last);
    }
  }, DEBOUNCE_MS);
}

function subscribeStock(listener) {
  emitter.on('stock.changed', listener);
  return () => emitter.off('stock.changed', listener);
}

module.exports = {
  publishStockChange,
  subscribeStock,
};
