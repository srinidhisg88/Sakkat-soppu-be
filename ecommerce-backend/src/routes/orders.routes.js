const express = require('express');
const { createOrder, getUserOrders, updateOrderStatus } = require('../controllers/orders.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const adminMiddleware = require('../middlewares/admin.middleware');

const router = express.Router();

// Create a new order
router.post('/', authMiddleware, createOrder);

// Get past orders for the authenticated user
router.get('/', authMiddleware, getUserOrders);

// Admin can update order status
router.put('/:orderId/status', authMiddleware, adminMiddleware, updateOrderStatus);

module.exports = router;