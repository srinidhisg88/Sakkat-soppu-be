const Product = require('../models/product.model');
const { subscribeStock } = require('../realtime/pubsub');

function writeEvent(res, event, data, id) {
  if (id != null) res.write(`id: ${id}\n`);
  if (event) res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

exports.stockHealth = (req, res) => {
  res.status(200).json({ status: 'ok' });
};

exports.stockStream = async (req, res) => {
  try {
    const idsParam = (req.query.ids || '').toString().trim();
    if (!idsParam) {
      return res.status(400).json({ message: 'ids query param is required' });
    }
    const ids = idsParam.split(',').map(s => s.trim()).filter(Boolean);
    const idSet = new Set(ids.map(String));

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    let nextId = Date.now();

    // initial snapshot
    try {
      const products = await Product.find({ _id: { $in: ids } }).select('_id stock updatedAt __v').lean();
      const snapshot = products.map(p => ({ productId: String(p._id), stock: p.stock ?? 0, version: p.__v, updatedAt: p.updatedAt }));
      writeEvent(res, 'stock:snapshot', snapshot, nextId++);
    } catch (_) {
      // ignore snapshot errors but keep stream open
    }

    // subscribe to updates
    const unsubscribe = subscribeStock((payload) => {
      try {
        if (!payload || !payload.productId) return;
        if (!idSet.has(String(payload.productId))) return;
        writeEvent(res, 'stock:update', payload, nextId++);
      } catch (_) { /* ignore */ }
    });

    // heartbeat every 25s
    const hb = setInterval(() => { try { res.write(': keep-alive\n\n'); } catch (_) {} }, 25000);

    req.on('close', () => {
      clearInterval(hb);
      try { unsubscribe(); } catch (_) {}
      try { res.end(); } catch (_) {}
    });
  } catch (e) {
    return res.status(500).json({ message: 'Failed to open stock stream' });
  }
};
