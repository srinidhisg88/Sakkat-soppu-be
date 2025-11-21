const mongoose = require('mongoose');

const cityDeliveryConfigSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  basePrice: { type: Number, required: true, min: 0 }, // Base price for first 1kg
  pricePerKg: { type: Number, required: true, min: 0 }, // Additional price per kg after first kg
  freeDeliveryThreshold: { type: Number, default: 0, min: 0 }, // Free delivery threshold for this city
}, { _id: false });

const deliveryConfigSchema = new mongoose.Schema({
  enabled: { type: Boolean, default: true },
  minOrderSubtotal: { type: Number, default: 0, min: 0 },
  cities: [cityDeliveryConfigSchema],
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

// Return a config object with safe defaults if none exists
deliveryConfigSchema.statics.getOrDefaults = async function() {
  const cfg = await this.findOne().lean();
  return cfg || { enabled: true, minOrderSubtotal: 0, cities: [] };
};

// Helper method to get city-specific config
deliveryConfigSchema.statics.getCityConfig = async function(cityName) {
  const cfg = await this.findOne().lean();
  if (!cfg || !cfg.cities || cfg.cities.length === 0) return null;

  const city = cfg.cities.find(c => c.name.toLowerCase() === cityName.toLowerCase());
  return city || null;
};

// Helper method to calculate delivery fee for a city based on weight
deliveryConfigSchema.statics.calculateDeliveryFee = async function(cityName, totalWeight, orderSubtotal) {
  const cfg = await this.findOne().lean();

  if (!cfg || !cfg.enabled) {
    return { success: false, message: 'Delivery is currently disabled' };
  }

  // Find city config
  const cityConfig = cfg.cities?.find(c => c.name.toLowerCase() === cityName.toLowerCase());

  if (!cityConfig) {
    return { success: false, message: `Delivery not available for ${cityName}` };
  }

  // Check if order qualifies for free delivery
  if (cityConfig.freeDeliveryThreshold > 0 && orderSubtotal >= cityConfig.freeDeliveryThreshold) {
    return { success: true, deliveryFee: 0, isFree: true };
  }

  // Calculate weight-based delivery fee
  // First 1kg uses base price, additional weight charged per kg
  const weight = Math.max(0, totalWeight);
  let deliveryFee = cityConfig.basePrice;

  if (weight > 1) {
    const additionalWeight = Math.ceil(weight - 1); // Round up additional weight
    deliveryFee += additionalWeight * cityConfig.pricePerKg;
  }

  return { success: true, deliveryFee, isFree: false };
};

module.exports = mongoose.model('DeliveryConfig', deliveryConfigSchema);
