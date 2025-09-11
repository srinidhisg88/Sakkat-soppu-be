const User = require('../models/user.model');
const Order = require('../models/order.model');
const Product = require('../models/product.model');
const logger = require('../config/logger');
const AuditLog = require('../models/auditLog.model');
const { logAudit } = require('../services/audit.service');

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

    const before = { role: user.role };
    user.role = role;
    await user.save();

    // Audit
    logAudit({ req, action: 'USER_ROLE_UPDATE', entityType: 'user', entityId: user._id, before, after: { role }, meta: {} });

        res.status(200).json({ message: 'User role updated successfully', user });
    } catch (error) {
        logger.error('Error managing user role: ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Get audit logs with filters and pagination
exports.getAuditLogs = async (req, res) => {
    try {
        const { actorId, action, entityType, entityId, from, to, page = 1, limit = 20, sort = '-createdAt' } = req.query;
        const pageNum = Math.max(parseInt(page, 10) || 1, 1);
        const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

        const filter = {};
        if (actorId) filter.actorId = actorId;
        if (action) filter.action = action;
        if (entityType) filter.entityType = entityType;
        if (entityId) filter.entityId = entityId;
        if (from || to) {
            filter.createdAt = {};
            if (from) filter.createdAt.$gte = new Date(from);
            if (to) filter.createdAt.$lte = new Date(to);
        }

        const [data, total] = await Promise.all([
            AuditLog.find(filter)
                .sort(sort)
                .skip((pageNum - 1) * limitNum)
                .limit(limitNum)
                .populate('actorId', 'name email role')
                .lean(),
            AuditLog.countDocuments(filter),
        ]);

        res.status(200).json({ data, page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) });
    } catch (error) {
        logger.error('Error fetching audit logs: ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};