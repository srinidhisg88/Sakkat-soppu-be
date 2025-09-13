function computeDeliveryFee(subtotal, config) {
  const cfg = config || {};
  const enabled = cfg.enabled !== false; // default enabled
  if (!enabled) return { deliveryFee: 0, freeDeliveryApplied: false };

  const fee = Math.max(0, Number(cfg.deliveryFee || 0));
  const threshold = Math.max(0, Number(cfg.freeDeliveryThreshold || 0));

  if (threshold > 0 && subtotal >= threshold) {
    return { deliveryFee: 0, freeDeliveryApplied: true };
  }
  return { deliveryFee: fee, freeDeliveryApplied: false };
}

module.exports = { computeDeliveryFee };
