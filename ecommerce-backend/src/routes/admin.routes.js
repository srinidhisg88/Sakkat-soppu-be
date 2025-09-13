const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const adminMiddleware = require('../middlewares/admin.middleware');
const { getAllOrders, getOrderById } = require('../controllers/orders.controller');
const couponsController = require('../controllers/coupons.controller');
const categoriesController = require('../controllers/categories.controller');
const { validateCouponCreate, validateCouponUpdate } = require('../utils/validators');
const settingsController = require('../controllers/settings.controller');

// Admin routes
router.use(authMiddleware);
router.use(adminMiddleware);

// Get analytics
router.get('/analytics', adminController.getAnalytics);

// Orders management
router.get('/orders', getAllOrders);
router.get('/orders/:id', getOrderById);

// Audit logs
router.get('/audit-logs', adminController.getAuditLogs);

// Coupons management
router.get('/coupons', couponsController.listCoupons);
router.get('/coupons/:id', couponsController.getCoupon);
router.post('/coupons', validateCouponCreate, couponsController.createCoupon);
router.put('/coupons/:id', validateCouponUpdate, couponsController.updateCoupon);
router.delete('/coupons/:id', couponsController.deleteCoupon);

// Categories management
router.get('/categories', categoriesController.adminList);
router.post('/categories', categoriesController.create);
router.put('/categories/:id', categoriesController.update);
router.delete('/categories/:id', categoriesController.remove);

// Delivery settings
router.get('/delivery-settings', settingsController.getDeliverySettings);
router.put('/delivery-settings', settingsController.updateDeliverySettings);

// Manage user roles
router.put('/users/:id/role', adminController.updateUserRole);

// Manage farmers
const farmerController = require('../controllers/farmer.controller');
const { validateFarmer } = require('../utils/validators');
router.post('/farmers', validateFarmer, farmerController.createFarmer);
router.put('/farmers/:id', farmerController.updateFarmer);
router.delete('/farmers/:id', farmerController.deleteFarmer);

// Export the router
module.exports = router;