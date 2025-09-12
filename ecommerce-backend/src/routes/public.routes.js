const express = require('express');
const router = express.Router();

const couponsController = require('../controllers/coupons.controller');

// Publicly accessible routes
// List coupons (optionally filter by active/q)
router.get('/coupons', couponsController.listCoupons);

module.exports = router;
