const mongoose = require('mongoose');

const deliveryConfigSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: true },
  deliveryFee: { type: Number, default: 0, min: 0 },
  freeDeliveryThreshold: { type: Number, default: 0, min: 0 },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// Return a config object with safe defaults if none exists
deliveryConfigSchema.statics.getOrDefaults = async function() {
  const cfg = await this.findOne().lean();
  return cfg || { enabled: true, deliveryFee: 0, freeDeliveryThreshold: 0 };
};

module.exports = mongoose.model('DeliveryConfig', deliveryConfigSchema);
