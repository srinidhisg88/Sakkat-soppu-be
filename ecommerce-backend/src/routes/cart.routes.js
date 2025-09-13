const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cart.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// View cart
router.get('/', authMiddleware, cartController.viewCart);


// Add to cart
router.post('/add', authMiddleware, cartController.addToCart);

// Remove from cart
router.delete('/remove/:productId', authMiddleware, cartController.removeFromCart);

// Update item quantity (increment/decrement/set)
router.patch('/item', authMiddleware, cartController.updateCartItem);

// Clear cart
router.post('/clear', authMiddleware, cartController.clearCart);

module.exports = router;
