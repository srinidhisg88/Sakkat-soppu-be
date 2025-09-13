const DeliveryConfig = require('../models/deliveryConfig.model');

exports.getDeliverySettings = async (req, res) => {
  try {
    const cfg = await DeliveryConfig.findOne().lean();
  const data = cfg || { enabled: true, deliveryFee: 0, freeDeliveryThreshold: 0, minOrderSubtotal: 0 };
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ message: 'Failed to fetch delivery settings' });
  }
};

exports.updateDeliverySettings = async (req, res) => {
  try {
  const { enabled, deliveryFee, freeDeliveryThreshold, minOrderSubtotal } = req.body || {};
    const payload = {};
    if (enabled !== undefined) payload.enabled = !!enabled;
    if (deliveryFee !== undefined) payload.deliveryFee = Math.max(0, Number(deliveryFee));
    if (freeDeliveryThreshold !== undefined) payload.freeDeliveryThreshold = Math.max(0, Number(freeDeliveryThreshold));
  if (minOrderSubtotal !== undefined) payload.minOrderSubtotal = Math.max(0, Number(minOrderSubtotal));
    if (req.user && req.user.id) payload.updatedBy = req.user.id;

    const cfg = await DeliveryConfig.findOneAndUpdate({}, { $set: payload }, { new: true, upsert: true });
    return res.status(200).json(cfg);
  } catch (e) {
    return res.status(500).json({ message: 'Failed to update delivery settings' });
  }
};

exports.getPublicDeliverySettings = async (req, res) => {
  try {
    const cfg = await DeliveryConfig.getOrDefaults();
  const { enabled = true, deliveryFee = 0, freeDeliveryThreshold = 0, minOrderSubtotal = 0 } = cfg;
  return res.status(200).json({ enabled, deliveryFee, freeDeliveryThreshold, minOrderSubtotal });
  } catch (e) {
    return res.status(500).json({ message: 'Failed to fetch settings' });
  }
};
