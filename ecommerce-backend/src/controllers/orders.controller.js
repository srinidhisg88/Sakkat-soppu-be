const Order = require('../models/order.model');
const User = require('../models/user.model');
const Product = require('../models/product.model');
const { sendOrderConfirmation, sendNewOrderNotification } = require('../services/email.service');

// Create a new order
exports.createOrder = async (req, res) => {
    const { items, totalPrice, address, latitude, longitude } = req.body;
    const userId = req.user.id;

    try {
        // Use user's saved location if not provided
        const user = await User.findById(userId);
        const orderLat = latitude ?? user.latitude;
        const orderLng = longitude ?? user.longitude;

        // Check stock atomically and decrement using findOneAndUpdate
    for (const item of items) {
            const updated = await Product.findOneAndUpdate(
                { _id: item.productId, stock: { $gte: item.quantity } },
                { $inc: { stock: -item.quantity } },
                { new: true }
            );

            if (!updated) {
                return res.status(400).json({ message: `Insufficient stock for product ${item.productId}` });
            }
            // ensure price recorded per item
            item.price = updated.price;
            // attach product name for email/template readability
            item.name = updated.name || item.name || `product-${item.productId}`;
        }

        // Prefer device-provided coordinates (frontend should send latitude & longitude when available).
        // Fall back to user's saved coordinates if not provided.
        const resolvedLat = latitude ?? user.latitude ?? null;
        const resolvedLng = longitude ?? user.longitude ?? null;

        const order = new Order({
            userId,
            items,
            totalPrice,
            status: 'pending',
            paymentMode: 'COD',
            address,
            latitude: resolvedLat,
            longitude: resolvedLng,
            createdAt: new Date(),
        });

        await order.save();

        // Clear user's cart after successful checkout
        try {
            user.cart = [];
            await user.save();
        } catch (err) {
            console.error('Failed to clear user cart after order:', err);
        }

        // Prepare a sanitized order payload for emails/templates (include mapsLink if we have coords)
        const mapsLink = (order.latitude != null && order.longitude != null)
            ? `https://www.google.com/maps/search/?api=1&query=${order.latitude},${order.longitude}`
            : null;

        const orderForEmail = {
            customerName: user.name || user.email || 'Customer',
            _id: order._id,
            orderId: String(order._id),
            totalPrice: order.totalPrice,
            address: order.address,
            items: order.items.map(i => ({ name: i.name || i.productName || i.productId, quantity: i.quantity, price: i.price })),
            
        };

        // Send notifications (best-effort)
        try {
            await sendOrderConfirmation(user.email, orderForEmail);
        } catch (err) {
            console.error('Error sending confirmation email', err);
        }

        try {
            const adminEmail = process.env.ADMIN_EMAIL;
            if (adminEmail) await sendNewOrderNotification(adminEmail, { order: orderForEmail, mapsLink });
        } catch (err) {
            console.error('Error sending new order notification', err);
        }

        res.status(201).json(order);
    } catch (error) {
        console.error('Error creating order', error);
        res.status(500).json({ message: 'Error creating order' });
    }
};

// Fetch past orders for a user
exports.getUserOrders = async (req, res) => {
    const userId = req.user.id;

    try {
        const orders = await Order.find({ userId }).sort({ createdAt: -1 });
        res.status(200).json(orders);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching orders' });
    }
};

// Admin: Update order status
exports.updateOrderStatus = async (req, res) => {
    const { orderId } = req.params;
    const { status } = req.body;

    try {
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const prevStatus = order.status;
        order.status = status;
        await order.save();

        // If status changed to 'confirmed', send admin a Google Maps link for the order location via email and SMS
        if (prevStatus !== 'confirmed' && status === 'confirmed') {
            const lat = order.latitude;
            const lng = order.longitude;
            const mapsLink = (lat != null && lng != null)
                ? `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
                : 'Location not available';

            // Send email notification to admin (if configured)
            try {
                const adminEmail = process.env.ADMIN_EMAIL;
                if (adminEmail) {
                    const { sendNewOrderNotification } = require('../services/email.service');
                    await sendNewOrderNotification(adminEmail, { order, mapsLink });
                }
            } catch (err) {
                console.error('Error sending admin confirmation email with maps link', err);
            }

            // Send SMS to admin (if configured)
            try {
                const adminPhone = process.env.ADMIN_PHONE;
                if (adminPhone) {
                    const { sendSmsToAdmin } = require('../services/sms.service');
                    const smsBody = `New order confirmed. ID: ${order._id}. Total: ${order.totalPrice}. Maps: ${mapsLink}`;
                    await sendSmsToAdmin(adminPhone, smsBody);
                }
            } catch (err) {
                console.error('Error sending admin SMS with maps link', err);
            }
        }

        res.status(200).json(order);
    } catch (error) {
        res.status(500).json({ message: 'Error updating order status' });
    }
};