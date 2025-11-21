const DeliveryConfig = require('../models/deliveryConfig.model');

// Get delivery settings (admin view)
exports.getDeliverySettings = async (req, res) => {
  try {
    const cfg = await DeliveryConfig.findOne().lean();
    const data = cfg || { enabled: true, minOrderSubtotal: 0, cities: [] };
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ message: 'Failed to fetch delivery settings' });
  }
};

// Update delivery settings (admin only)
exports.updateDeliverySettings = async (req, res) => {
  try {
    const { enabled, minOrderSubtotal, cities } = req.body || {};
    const payload = {};

    if (enabled !== undefined) payload.enabled = !!enabled;
    if (minOrderSubtotal !== undefined) payload.minOrderSubtotal = Math.max(0, Number(minOrderSubtotal));

    // Validate and process cities array
    if (cities !== undefined) {
      if (!Array.isArray(cities)) {
        return res.status(400).json({ message: 'Cities must be an array' });
      }

      payload.cities = cities.map(city => {
        if (!city.name || city.basePrice === undefined || city.pricePerKg === undefined) {
          throw new Error('Each city must have name, basePrice, and pricePerKg');
        }
        return {
          name: String(city.name).trim(),
          basePrice: Math.max(0, Number(city.basePrice)),
          pricePerKg: Math.max(0, Number(city.pricePerKg)),
          freeDeliveryThreshold: city.freeDeliveryThreshold !== undefined
            ? Math.max(0, Number(city.freeDeliveryThreshold))
            : 0
        };
      });
    }

    if (req.user && req.user.id) payload.updatedBy = req.user.id;

    const cfg = await DeliveryConfig.findOneAndUpdate({}, { $set: payload }, { new: true, upsert: true });
    return res.status(200).json(cfg);
  } catch (e) {
    return res.status(400).json({ message: e.message || 'Failed to update delivery settings' });
  }
};

// Add or update a specific city
exports.updateCityDeliverySettings = async (req, res) => {
  try {
    const { cityName } = req.params;
    const { basePrice, pricePerKg, freeDeliveryThreshold } = req.body || {};

    if (!cityName) {
      return res.status(400).json({ message: 'City name is required' });
    }

    if (basePrice === undefined || pricePerKg === undefined) {
      return res.status(400).json({ message: 'basePrice and pricePerKg are required' });
    }

    const cityConfig = {
      name: cityName.trim(),
      basePrice: Math.max(0, Number(basePrice)),
      pricePerKg: Math.max(0, Number(pricePerKg)),
      freeDeliveryThreshold: freeDeliveryThreshold !== undefined
        ? Math.max(0, Number(freeDeliveryThreshold))
        : 0
    };

    // Check if city exists, update or add
    const cfg = await DeliveryConfig.findOne();

    if (!cfg) {
      // Create new config with this city
      const newCfg = await DeliveryConfig.create({
        enabled: true,
        minOrderSubtotal: 0,
        cities: [cityConfig],
        updatedBy: req.user?.id
      });
      return res.status(200).json(newCfg);
    }

    // Find and update existing city or add new one
    const cityIndex = cfg.cities.findIndex(c => c.name.toLowerCase() === cityName.toLowerCase());

    if (cityIndex >= 0) {
      cfg.cities[cityIndex] = cityConfig;
    } else {
      cfg.cities.push(cityConfig);
    }

    if (req.user && req.user.id) cfg.updatedBy = req.user.id;
    await cfg.save();

    return res.status(200).json(cfg);
  } catch (e) {
    return res.status(400).json({ message: e.message || 'Failed to update city delivery settings' });
  }
};

// Delete a specific city
exports.deleteCityDeliverySettings = async (req, res) => {
  try {
    const { cityName } = req.params;

    if (!cityName) {
      return res.status(400).json({ message: 'City name is required' });
    }

    const cfg = await DeliveryConfig.findOne();

    if (!cfg) {
      return res.status(404).json({ message: 'Delivery configuration not found' });
    }

    cfg.cities = cfg.cities.filter(c => c.name.toLowerCase() !== cityName.toLowerCase());

    if (req.user && req.user.id) cfg.updatedBy = req.user.id;
    await cfg.save();

    return res.status(200).json(cfg);
  } catch (e) {
    return res.status(500).json({ message: 'Failed to delete city delivery settings' });
  }
};

// Get public delivery settings (all cities)
exports.getPublicDeliverySettings = async (req, res) => {
  try {
    const cfg = await DeliveryConfig.getOrDefaults();
    const { enabled = true, minOrderSubtotal = 0, cities = [] } = cfg;
    return res.status(200).json({ enabled, minOrderSubtotal, cities });
  } catch (e) {
    return res.status(500).json({ message: 'Failed to fetch settings' });
  }
};

// Calculate delivery fee for a specific city and weight
exports.calculateDeliveryFee = async (req, res) => {
  try {
    const { city, totalWeight, orderSubtotal } = req.body || {};

    if (!city) {
      return res.status(400).json({ message: 'City is required' });
    }

    if (totalWeight === undefined || orderSubtotal === undefined) {
      return res.status(400).json({ message: 'totalWeight and orderSubtotal are required' });
    }

    const result = await DeliveryConfig.calculateDeliveryFee(
      city,
      Number(totalWeight),
      Number(orderSubtotal)
    );

    if (!result.success) {
      return res.status(400).json({ message: result.message });
    }

    return res.status(200).json({
      city,
      deliveryFee: result.deliveryFee,
      isFree: result.isFree
    });
  } catch (e) {
    return res.status(500).json({ message: 'Failed to calculate delivery fee' });
  }
};
