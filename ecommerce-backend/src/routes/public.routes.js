const express = require('express');
const router = express.Router();

const couponsController = require('../controllers/coupons.controller');
const { getPublicDeliverySettings } = require('../controllers/settings.controller');

// Publicly accessible routes
// List coupons (optionally filter by active/q)
router.get('/coupons', couponsController.listCoupons);

// Public delivery settings
router.get('/settings/delivery', getPublicDeliverySettings);

module.exports = router;
