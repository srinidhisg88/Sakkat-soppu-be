const Order = require('../models/order.model');
const User = require('../models/user.model');
const Product = require('../models/product.model');
const { sendOrderConfirmation, sendNewOrderNotification } = require('../services/email.service');

// Admin: list all orders with optional filters and pagination
exports.getAllOrders = async (req, res) => {
    try {
        const {
            status,
            userId,
            from, // ISO date string
            to,   // ISO date string
            page = 1,
            limit = 20,
            sort = '-createdAt',
        } = req.query;

        const pageNum = Math.max(parseInt(page, 10) || 1, 1);
        const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

        const filter = {};
        if (status) filter.status = status;
        if (userId) filter.userId = userId;
        if (from || to) {
            filter.createdAt = {};
            if (from) filter.createdAt.$gte = new Date(from);
            if (to) filter.createdAt.$lte = new Date(to);
        }

        const [data, total] = await Promise.all([
            Order.find(filter)
                .sort(sort)
                .skip((pageNum - 1) * limitNum)
                .limit(limitNum)
                .populate('userId', 'name email phone')
                .populate('items.productId', 'name')
                .lean(),
            Order.countDocuments(filter),
        ]);

        return res.status(200).json({ data, page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) });
    } catch (error) {
        console.error('Error listing all orders', error);
        return res.status(500).json({ message: 'Error fetching orders' });
    }
};

// Admin: get single order by id (populated)
exports.getOrderById = async (req, res) => {
    try {
        const { id } = req.params;
        const order = await Order.findById(id)
            .populate('userId', 'name email phone')
            .populate('items.productId', 'name price')
            .lean();
        if (!order) return res.status(404).json({ message: 'Order not found' });
        return res.status(200).json(order);
    } catch (error) {
        console.error('Error fetching order by id', error);
        return res.status(500).json({ message: 'Error fetching order' });
    }
};

// Helper to build an order payload for emails with product names populated
async function buildOrderEmailPayload(order, userDoc) {
    try {
        // Build product map for names/prices
        const productIds = (order.items || [])
            .map(i => (i.productId && i.productId._id ? i.productId._id : i.productId))
            .filter(Boolean)
            .map(id => id.toString());

        const uniqueIds = [...new Set(productIds)];
        const products = uniqueIds.length > 0
            ? await Product.find({ _id: { $in: uniqueIds } }).select('_id name price')
            : [];
        const productMap = new Map(products.map(p => [p._id.toString(), p]));

        // Optionally fetch user if not provided
        let customerName = 'Customer';
        let customerPhone = '';
        if (userDoc && (userDoc.name || userDoc.email)) {
            customerName = userDoc.name || userDoc.email;
            customerPhone = userDoc.phone || '';
        } else if (order.userId) {
            const User = require('../models/user.model');
            const u = await User.findById(order.userId).select('name email phone');
            if (u) {
                customerName = u.name || u.email || customerName;
                customerPhone = u.phone || '';
            }
        }

        const items = (order.items || []).map(i => {
            const key = i.productId && i.productId._id ? i.productId._id.toString() : (i.productId ? i.productId.toString() : '');
            const p = productMap.get(key);
            return {
                name: i.name || i.productName || (p ? p.name : key),
                quantity: i.quantity,
                price: i.price || (p ? p.price : undefined),
                unitLabel: i.unitLabel || null,
                priceForUnitLabel: i.priceForUnitLabel || null,
                unitPrice: i.priceForUnitLabel || null, // alias for template compatibility
                unit: i.unitLabel || null, // alias for template compatibility
                lineTotal: (i.price || (p ? p.price : 0)) * (i.quantity || 0),
            };
        });

        return {
            customerName,
            customerPhone,
            _id: order._id,
            orderId: String(order._id),
            totalPrice: order.totalPrice,
            address: order.address,
            latitude: order.latitude ?? null,
            longitude: order.longitude ?? null,
            status: order.status,
            paymentMode: order.paymentMode,
            paymentMethod: order.paymentMode, // alias for template compatibility
            createdAt: order.createdAt,
            subtotalPrice: order.subtotalPrice ?? null,
            discountAmount: order.discountAmount ?? 0,
            couponCode: order.couponCode ?? null,
            deliveryFee: order.deliveryFee ?? 0,
            freeDeliveryApplied: !!order.freeDeliveryApplied,
            items,
        };
    } catch (err) {
        console.error('Failed to build order email payload', err);
        return {
            customerName: userDoc?.name || userDoc?.email || 'Customer',
            customerPhone: userDoc?.phone || '',
            _id: order._id,
            orderId: String(order._id),
            totalPrice: order.totalPrice,
            address: order.address,
            latitude: order.latitude ?? null,
            longitude: order.longitude ?? null,
            status: order.status,
            paymentMode: order.paymentMode,
            paymentMethod: order.paymentMode, // alias for template compatibility
            createdAt: order.createdAt,
            subtotalPrice: order.subtotalPrice ?? null,
            discountAmount: order.discountAmount ?? 0,
            couponCode: order.couponCode ?? null,
            deliveryFee: order.deliveryFee ?? 0,
            freeDeliveryApplied: !!order.freeDeliveryApplied,
            items: (order.items || []).map(i => ({
                name: i.name || i.productName || String(i.productId),
                quantity: i.quantity,
                price: i.price,
                unitLabel: i.unitLabel || null,
                priceForUnitLabel: i.priceForUnitLabel || null,
                unitPrice: i.priceForUnitLabel || null, // alias for template compatibility
                unit: i.unitLabel || null, // alias for template compatibility
                lineTotal: (i.price || 0) * (i.quantity || 0),
            })),
        };
    }
}

// Create a new order with partial-fulfillment, idempotency, and Mongo transaction
exports.createOrder = async (req, res) => {
    const { address, latitude, longitude, paymentMode, idempotencyKey, couponCode } = req.body;
    const userId = req.user.id;

    const session = await Order.startSession();
    try {
        // Idempotency check (outside tx to short-circuit fast)
        if (idempotencyKey) {
            const existing = await Order.findOne({ userId, idempotencyKey });
            if (existing) {
                return res.status(200).json({ message: 'Order already created', order: existing, itemsOutOfStock: [] });
            }
        }

        // Load user with cart
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (!user.cart || user.cart.length === 0) {
            return res.status(400).json({ message: 'Cart is empty' });
        }

        await session.startTransaction();

        const fulfilledItems = [];
        const outOfStock = [];

        // Process each cart item and attempt atomic stock decrement within the session
        for (const cartItem of user.cart) {
            const productId = cartItem.productId;
            const quantity = cartItem.quantity || 1;

            const updated = await Product.findOneAndUpdate(
                { _id: productId, stock: { $gte: quantity } },
                { $inc: { stock: -quantity } },
                { new: true, session }
            );

            if (!updated) {
                // Query available stock for reporting
                const current = await Product.findById(productId).select('stock name').session(session);
                outOfStock.push({ productId: productId.toString(), requested: quantity, available: current ? current.stock : 0, name: current?.name });
                continue;
            }

            fulfilledItems.push({
                productId,
                quantity,
                price: updated.price, // price from DB at checkout
                name: updated.name,
                g: typeof updated.g === 'number' ? updated.g : undefined,
                pieces: typeof updated.pieces === 'number' ? updated.pieces : undefined,
                unitLabel: updated.unitLabel || null,
                priceForUnitLabel: updated.priceForUnitLabel || null,
            });

            // Publish stock change for this product
            try {
                const { publishStockChange } = require('../realtime/pubsub');
                publishStockChange({
                    productId: String(updated._id),
                    stock: updated.stock,
                    version: updated.__v,
                    updatedAt: updated.updatedAt,
                });
            } catch (_) {}
        }

        if (fulfilledItems.length === 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(409).json({ message: 'All items are out of stock', itemsOutOfStock: outOfStock });
        }

    // Compute totals
    const subtotal = fulfilledItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);

        // Enforce minimum order subtotal BEFORE coupon discount and delivery fee
        try {
            const DeliveryConfig = require('../models/deliveryConfig.model');
            const cfg = await DeliveryConfig.getOrDefaults();
            const minRequired = Number(cfg.minOrderSubtotal || 0);
            if (minRequired > 0 && subtotal < minRequired) {
                await session.abortTransaction();
                session.endSession();
                const shortfall = Number((minRequired - subtotal).toFixed(2));
                return res.status(400).json({
                    message: 'Minimum order amount not met',
                    reason: 'MIN_ORDER_NOT_MET',
                    minOrderSubtotal: minRequired,
                    subtotal,
                    shortfall,
                    itemsOutOfStock: outOfStock,
                });
            }
        } catch (e) {
            // If settings fetch fails, do not block checkout
        }

        // Optional coupon application
        let discountAmount = 0;
        let appliedCode = undefined;
        if (couponCode) {
            try {
                const Coupon = require('../models/coupon.model');
                const now = new Date();
                const code = String(couponCode).toUpperCase();
                const c = await Coupon.findOne({ code, isActive: true });
                if (!c) {
                    // Ignore invalid codes silently; frontends can pre-validate
                } else if ((c.startsAt && now < c.startsAt) || (c.expiresAt && now > c.expiresAt)) {
                    // expired or not started
                } else if (c.usageLimit && c.usageCount >= c.usageLimit) {
                    // exhausted
                } else if (subtotal < (c.minOrderValue || 0)) {
                    // below min order value
                } else {
                    if (c.discountType === 'percentage') {
                        discountAmount = (subtotal * c.discountValue) / 100;
                        if (c.maxDiscount) discountAmount = Math.min(discountAmount, c.maxDiscount);
                    } else if (c.discountType === 'amount') {
                        discountAmount = c.discountValue;
                    }
                    discountAmount = Math.max(0, Math.min(discountAmount, subtotal));
                    appliedCode = code;
                }
            } catch (e) {
                console.error('Coupon application failed', e);
            }
        }

    // (Minimum order already enforced above before coupon/fee)

        // Delivery fee
        let deliveryFee = 0;
        let freeDeliveryApplied = false;
        try {
            const DeliveryConfig = require('../models/deliveryConfig.model');
            const { computeDeliveryFee } = require('../utils/delivery');
            const cfg = await DeliveryConfig.getOrDefaults();
            const calc = computeDeliveryFee(subtotal - discountAmount, cfg);
            deliveryFee = calc.deliveryFee || 0;
            freeDeliveryApplied = !!calc.freeDeliveryApplied;
        } catch (e) {
            // fallback silently
        }

        const total = Number(((subtotal - discountAmount) + deliveryFee).toFixed(2));
        const resolvedLat = latitude ?? user.latitude ?? null;
        const resolvedLng = longitude ?? user.longitude ?? null;

        // Create the order (with idempotencyKey if provided)
        const order = await Order.create([{
            userId,
            items: fulfilledItems.map(i => ({
                productId: i.productId,
                quantity: i.quantity,
                price: i.price,
                name: i.name,
                g: i.g,
                pieces: i.pieces,
                unitLabel: i.unitLabel,
                priceForUnitLabel: i.priceForUnitLabel,
            })),
            totalPrice: total,
            subtotalPrice: Number(subtotal.toFixed(2)),
            discountAmount: Number(discountAmount.toFixed(2)),
            couponCode: appliedCode,
            deliveryFee: Number(deliveryFee.toFixed ? deliveryFee.toFixed(2) : deliveryFee),
            freeDeliveryApplied,
            status: 'pending',
            paymentMode: paymentMode || 'COD',
            address,
            latitude: resolvedLat,
            longitude: resolvedLng,
            createdAt: new Date(),
            idempotencyKey: idempotencyKey || undefined,
        }], { session });

        const createdOrder = order[0];

        // If a coupon was applied, increment usage (post-commit safe best effort)
        if (createdOrder.couponCode) {
            try {
                const Coupon = require('../models/coupon.model');
                await Coupon.updateOne({ code: createdOrder.couponCode }, { $inc: { usageCount: 1 } }).exec();
            } catch (e) {
                console.error('Failed to increment coupon usage', e);
            }
        }

        // Remove only the fulfilled items from the cart, keep out-of-stock
        // Reduce quantities in cart by fulfilled units; remove only when fully fulfilled
        const fulfilledMap = new Map();
        for (const fi of fulfilledItems) {
            const key = String(fi.productId);
            fulfilledMap.set(key, (fulfilledMap.get(key) || 0) + (fi.quantity || 0));
        }
        user.cart = user.cart
            .map(ci => {
                const key = String(ci.productId);
                const fulfilled = fulfilledMap.get(key) || 0;
                const newQty = (ci.quantity || 0) - fulfilled;
                return { ...ci.toObject(), quantity: newQty };
            })
            .filter(ci => (ci.quantity || 0) > 0);
        await user.save({ session });

        await session.commitTransaction();
        session.endSession();

        // Prepare email payload and notifications (async, fire-and-forget)
        const mapsLink = (createdOrder.latitude != null && createdOrder.longitude != null)
            ? `https://www.google.com/maps/search/?api=1&query=${createdOrder.latitude},${createdOrder.longitude}`
            : null;

        const orderForEmail = await buildOrderEmailPayload(createdOrder, user);

        (async () => {
            try { await sendOrderConfirmation(user.email, { order: orderForEmail }); } catch (e) { console.error('Email user failed', e); }
            try {
                const adminEmail = process.env.ADMIN_EMAIL;
                if (adminEmail) await sendNewOrderNotification(adminEmail, { order: orderForEmail, mapsLink });
            } catch (e) { console.error('Email admin failed', e); }
            try {
                const adminPhone = process.env.ADMIN_PHONE;
                if (adminPhone) {
                    const { sendSmsToAdmin } = require('../services/sms.service');
                    const portal = 'https://admin.sakkatsoppu.com';
                    const smsBody = `New order received. ID: ${createdOrder._id}.\nStatus: pending. Visit portal to confirm address: ${portal}`.trim();
                    await sendSmsToAdmin(adminPhone, smsBody);
                }
            } catch (e) { console.error('SMS admin failed', e); }
        })();

        return res.status(201).json({ message: 'Order created for available items', order: createdOrder, itemsOutOfStock: outOfStock });
    } catch (error) {
        try { await session.abortTransaction(); } catch (_) {}
        session.endSession();
        console.error('Error creating order (partial flow)', error);
        // Handle idempotency race (unique index) gracefully
        if (idempotencyKey && error && error.code === 11000) {
            const existing = await Order.findOne({ userId, idempotencyKey });
            if (existing) return res.status(200).json({ message: 'Order already created', order: existing, itemsOutOfStock: [] });
        }
        return res.status(500).json({ message: 'Error creating order' });
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
        // Validate status against allowed transitions
        const allowed = new Set(['pending', 'confirmed', 'delivered', 'cancelled']);
        if (!allowed.has(status)) {
            return res.status(400).json({ message: 'Invalid status value' });
        }

    const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        const prevStatus = order.status;
        order.status = status;
        await order.save();

        // Audit log for status change
        try {
            const { logAudit } = require('../services/audit.service');
            logAudit({
                req,
                action: 'ORDER_STATUS_UPDATE',
                entityType: 'order',
                entityId: order._id,
                before: { status: prevStatus },
                after: { status },
                meta: {}
            });
        } catch (e) {
            console.error('Audit log failed for order status update', e);
        }

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
            const orderForEmail = await buildOrderEmailPayload(order);
            await sendNewOrderNotification(adminEmail, { order: orderForEmail, mapsLink });
                }
            } catch (err) {
                console.error('Error sending admin confirmation email with maps link', err);
            }

        // Send SMS to admin (if configured)
            try {
                const adminPhone = process.env.ADMIN_PHONE;
                if (adminPhone) {
                    const { sendSmsToAdmin } = require('../services/sms.service');
            const orderForEmail = await buildOrderEmailPayload(order);
            const items = orderForEmail.items || [];
            const itemsPreview = items.slice(0, 3).map(i => `${i.name} x${i.quantity}`).join(', ');
            const more = items.length > 3 ? `, +${items.length - 3} more` : '';
            const customer = `${orderForEmail.customerName}${orderForEmail.customerPhone ? ` (${orderForEmail.customerPhone})` : ''}`;
            const smsBody = `Order confirmed ${order._id}.\n By: ${customer}. \nItems: ${itemsPreview}${more}.\n Total: ${order.totalPrice}.\n Link to their location: ${mapsLink}\n`;
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