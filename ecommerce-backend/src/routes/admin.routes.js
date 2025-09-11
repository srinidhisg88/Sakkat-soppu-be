const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const adminMiddleware = require('../middlewares/admin.middleware');
const { getAllOrders, getOrderById } = require('../controllers/orders.controller');
const couponsController = require('../controllers/coupons.controller');
const { validateCouponCreate, validateCouponUpdate } = require('../utils/validators');

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