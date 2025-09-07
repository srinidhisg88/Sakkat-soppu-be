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
