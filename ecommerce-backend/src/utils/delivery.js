// Legacy function - kept for backward compatibility
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

// New city-based weight calculation using the DeliveryConfig model's static method
async function computeCityBasedDeliveryFee(city, totalWeight, orderSubtotal) {
  try {
    const DeliveryConfig = require('../models/deliveryConfig.model');
    const result = await DeliveryConfig.calculateDeliveryFee(city, totalWeight, orderSubtotal);

    if (!result.success) {
      // Return error details for handling in controller
      return {
        success: false,
        error: result.message,
        deliveryFee: 0,
        freeDeliveryApplied: false
      };
    }

    return {
      success: true,
      deliveryFee: result.deliveryFee,
      freeDeliveryApplied: result.isFree
    };
  } catch (error) {
    console.error('Error computing city-based delivery fee:', error);
    return {
      success: false,
      error: 'Failed to calculate delivery fee',
      deliveryFee: 0,
      freeDeliveryApplied: false
    };
  }
}

module.exports = { computeDeliveryFee, computeCityBasedDeliveryFee };
