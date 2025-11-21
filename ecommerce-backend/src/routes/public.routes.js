const express = require('express');
const router = express.Router();

const couponsController = require('../controllers/coupons.controller');
const { getPublicDeliverySettings, calculateDeliveryFee } = require('../controllers/settings.controller');
const categoriesController = require('../controllers/categories.controller');
const productsController = require('../controllers/products.controller');
const homeVideosController = require('../controllers/homeVideos.controller');

// Publicly accessible routes
// List coupons (optionally filter by active/q)
router.get('/coupons', couponsController.listCoupons);

// Public delivery settings
router.get('/settings/delivery', getPublicDeliverySettings);
router.post('/settings/delivery/calculate', calculateDeliveryFee);

// Public categories
router.get('/categories', categoriesController.listPublic);

// Public products by category with pagination
router.get('/categories/:categoryId/products', productsController.getProductsByCategory);

// Public homepage videos
router.get('/homepage-videos', homeVideosController.listPublicVideos);

module.exports = router;
