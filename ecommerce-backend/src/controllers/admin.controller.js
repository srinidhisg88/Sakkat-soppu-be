const User = require('../models/user.model');
const Order = require('../models/order.model');
const Product = require('../models/product.model');
const logger = require('../config/logger');

// Get analytics data for admin
exports.getAnalytics = async (req, res) => {
    try {
        const totalUsers = await User.countDocuments();
        const totalOrders = await Order.countDocuments();
        const totalProducts = await Product.countDocuments();
        
        const totalSales = await Order.aggregate([
            { $match: { status: 'delivered' } },
            { $group: { _id: null, total: { $sum: '$totalPrice' } } }
        ]);

        res.status(200).json({
            totalUsers,
            totalOrders,
            totalProducts,
            totalSales: totalSales[0]?.total || 0
        });
    } catch (error) {
        logger.error('Error fetching analytics: ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Manage user roles (e.g., promote to admin)
exports.updateUserRole = async (req, res) => {
    const { role } = req.body;
    const userId = req.params.id;

    if (!userId || !role) {
        return res.status(400).json({ message: 'User ID and role are required' });
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.role = role;
        await user.save();

        res.status(200).json({ message: 'User role updated successfully', user });
    } catch (error) {
        logger.error('Error managing user role: ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};