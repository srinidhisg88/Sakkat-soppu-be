const User = require('../models/user.model');
const Product = require('../models/product.model');
const logger = require('../config/logger');

// View cart (populate product details)
exports.viewCart = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId).populate('cart.productId');
        if (!user) return res.status(404).json({ message: 'User not found' });
        res.status(200).json({ cart: user.cart });
    } catch (err) {
        logger.error('Error viewing cart', err);
        res.status(500).json({ message: 'Error viewing cart' });
    }
};

// Add product to cart (increment if exists)
exports.addToCart = async (req, res) => {
    try {
        const userId = req.user.id;
        const { productId, quantity = 1 } = req.body;

        const product = await Product.findById(productId);
        if (!product) return res.status(404).json({ message: 'Product not found' });

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const existing = user.cart.find(c => String(c.productId) === String(productId));
        if (existing) {
            existing.quantity = Math.max(1, existing.quantity + Number(quantity));
        } else {
            user.cart.push({ productId, quantity: Number(quantity) });
        }

        await user.save();
        const populated = await User.findById(userId).populate('cart.productId');
        res.status(200).json({ cart: populated.cart });
    } catch (err) {
        logger.error('Error adding to cart', err);
        res.status(500).json({ message: 'Error adding to cart' });
    }
};

// Remove product from cart
exports.removeFromCart = async (req, res) => {
    try {
        const userId = req.user.id;
        const { productId } = req.params;

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        user.cart = user.cart.filter(c => String(c.productId) !== String(productId));
        await user.save();

        const populated = await User.findById(userId).populate('cart.productId');
        res.status(200).json({ cart: populated.cart });
    } catch (err) {
        logger.error('Error removing from cart', err);
        res.status(500).json({ message: 'Error removing from cart' });
    }
};

// Clear cart
exports.clearCart = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        user.cart = [];
        await user.save();
        res.status(200).json({ message: 'Cart cleared', cart: [] });
    } catch (err) {
        logger.error('Error clearing cart', err);
        res.status(500).json({ message: 'Error clearing cart' });
    }
};

// Update cart item quantity
exports.updateCartItem = async (req, res) => {
    try {
        const userId = req.user.id;
        const { productId, action, quantity } = req.body || {};

        if (!productId) return res.status(400).json({ message: 'productId is required' });

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const item = user.cart.find(c => String(c.productId) === String(productId));
        if (!item) return res.status(404).json({ message: 'Product not in cart' });

        // If quantity provided, set directly (>=1); else use action inc/dec
        if (Number.isInteger(quantity)) {
            const q = Number(quantity);
            if (q <= 0) {
                // remove item if set to 0 or negative
                user.cart = user.cart.filter(c => String(c.productId) !== String(productId));
            } else {
                item.quantity = q;
            }
        } else if (action === 'increment') {
            item.quantity = Math.max(1, item.quantity + 1);
        } else if (action === 'decrement') {
            const newQty = item.quantity - 1;
            if (newQty <= 0) {
                // remove when decrementing last unit
                user.cart = user.cart.filter(c => String(c.productId) !== String(productId));
            } else {
                item.quantity = newQty;
            }
        } else {
            return res.status(400).json({ message: 'Provide a valid action (increment|decrement) or quantity' });
        }

        await user.save();

        const populated = await User.findById(userId).populate('cart.productId');
        return res.status(200).json({ cart: populated.cart });
    } catch (err) {
        logger.error('Error updating cart item', err);
        return res.status(500).json({ message: 'Error updating cart item' });
    }
};
