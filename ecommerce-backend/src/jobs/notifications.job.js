const logger = require('../config/logger');
const User = require('../models/user.model');
const Order = require('../models/order.model');
const { sendOrderConfirmation: sendOrderEmail, sendNewOrderNotification } = require('../services/email.service');

const sendOrderConfirmation = async (userId, orderDetails) => {
    try {
        const user = await User.findById(userId);
        if (!user) throw new Error('User not found');

        const orderForEmail = {
            customerName: user.name || user.email || 'Customer',
            _id: orderDetails._id || orderDetails.id,
            orderId: String(orderDetails._id || orderDetails.id || ''),
            totalPrice: orderDetails.totalPrice,
            address: orderDetails.address,
            items: (orderDetails.items || []).map(i => ({ name: i.name || i.productName || i.productId, quantity: i.quantity, price: i.price })),
        };

        await sendOrderEmail(user.email, orderForEmail);
        logger.info(`Order confirmation email sent to ${user.email}`);
    } catch (error) {
        logger.error(`Failed to send order confirmation: ${error.message}`);
    }
};

const notifyAdminNewOrder = async (orderId) => {
    try {
        const order = await Order.findById(orderId).populate('userId');
        if (!order) throw new Error('Order not found');

        const orderForEmail = {
            customerName: order.userId?.name || order.userId?.email || 'Customer',
            _id: order._id,
            orderId: String(order._id),
            totalPrice: order.totalPrice,
            address: order.address,
            items: (order.items || []).map(i => ({ name: i.name || i.productName || i.productId, quantity: i.quantity, price: i.price })),
        };

        const adminEmail = process.env.ADMIN_EMAIL;
        if (adminEmail) {
            await sendNewOrderNotification(adminEmail, { order: orderForEmail });
            logger.info(`Admin notified of new order: ${orderId}`);
        } else {
            logger.warn('ADMIN_EMAIL not configured; skipping admin notification');
        }
    } catch (error) {
        logger.error(`Failed to notify admin of new order: ${error.message}`);
    }
};

module.exports = {
    sendOrderConfirmation,
    notifyAdminNewOrder,
};