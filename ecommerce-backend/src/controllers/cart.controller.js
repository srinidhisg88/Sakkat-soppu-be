const User = require('../models/user.model');
const Product = require('../models/product.model');
const logger = require('../config/logger');
const DeliveryConfig = require('../models/deliveryConfig.model');
const { computeDeliveryFee } = require('../utils/delivery');

// View cart (populate product details)
exports.viewCart = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId).populate('cart.productId');
        if (!user) return res.status(404).json({ message: 'User not found' });
        // Ensure product virtuals are visible and add unit helpers at the top level of each item
        const cart = (user.cart || []).map(ci => ({
            ...ci.toObject(),
            productId: ci.productId,
            unitLabel: ci.productId?.unitLabel || null,
            priceForUnitLabel: ci.productId?.priceForUnitLabel || null,
        }));
        res.status(200).json({ cart });
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
        const cart = (populated.cart || []).map(ci => ({
            ...ci.toObject(),
            productId: ci.productId,
            unitLabel: ci.productId?.unitLabel || null,
            priceForUnitLabel: ci.productId?.priceForUnitLabel || null,
        }));
        res.status(200).json({ cart });
    } catch (err) {
        logger.error('Error adding to cart', err);
        res.status(500).json({ message: 'Error adding to cart' });
    }
};

// Remove product from cart (atomic to avoid version conflicts)
exports.removeFromCart = async (req, res) => {
    try {
        const userId = req.user.id;
        const { productId } = req.params;

        // Atomic $pull avoids VersionError under concurrent writes
        const updated = await User.findOneAndUpdate(
            { _id: userId },
            { $pull: { cart: { productId } } },
            { new: true }
        ).populate('cart.productId');

        if (!updated) return res.status(404).json({ message: 'User not found' });

        const cart = (updated.cart || []).map(ci => ({
            ...ci.toObject(),
            productId: ci.productId,
            unitLabel: ci.productId?.unitLabel || null,
            priceForUnitLabel: ci.productId?.priceForUnitLabel || null,
        }));
        res.status(200).json({ cart });
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

// Update cart item quantity (atomic operations to avoid version conflicts)
exports.updateCartItem = async (req, res) => {
    try {
        const userId = req.user.id;
        const { productId, action, quantity } = req.body || {};

        if (!productId) return res.status(400).json({ message: 'productId is required' });

        // Determine update
        let update;
        if (Number.isInteger(quantity)) {
            const q = Number(quantity);
            if (q <= 0) {
                // remove item
                update = { $pull: { cart: { productId } } };
            } else {
                update = { $set: { 'cart.$[elem].quantity': q } };
            }
        } else if (action === 'increment') {
            update = { $inc: { 'cart.$[elem].quantity': 1 } };
        } else if (action === 'decrement') {
            // We'll post-process: if decremented to <=0, pull it in a second step
            update = { $inc: { 'cart.$[elem].quantity': -1 } };
        } else {
            return res.status(400).json({ message: 'Provide a valid action (increment|decrement) or quantity' });
        }

        const options = {
            arrayFilters: [{ 'elem.productId': productId }],
            new: true,
        };

        let doc;
        if (update?.$pull) {
            doc = await User.findOneAndUpdate({ _id: userId }, update, { new: true }).populate('cart.productId');
        } else {
            doc = await User.findOneAndUpdate({ _id: userId }, update, options).populate('cart.productId');
        }
        if (!doc) return res.status(404).json({ message: 'User not found' });

        // If we decremented, ensure quantity >=1 else remove
        if (action === 'decrement') {
            const item = (doc.cart || []).find(c => String(c.productId) === String(productId));
            if (!item || item.quantity <= 0) {
                doc = await User.findOneAndUpdate(
                    { _id: userId },
                    { $pull: { cart: { productId } } },
                    { new: true }
                ).populate('cart.productId');
            }
        }

        const cart = (doc.cart || []).map(ci => ({
            ...ci.toObject(),
            productId: ci.productId,
            unitLabel: ci.productId?.unitLabel || null,
            priceForUnitLabel: ci.productId?.priceForUnitLabel || null,
        }));
        return res.status(200).json({ cart });
    } catch (err) {
        logger.error('Error updating cart item', err);
        return res.status(500).json({ message: 'Error updating cart item' });
    }
};

// (Cart summary endpoint removed; frontend computes totals)
