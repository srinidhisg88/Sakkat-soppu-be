const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    items: [{
        productId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'Product'
        },
        quantity: {
            type: Number,
            required: true,
            min: 1
        },
        price: {
            type: Number,
            required: true
    },
    // Snapshots to preserve product state at time of order
    name: { type: String },
    g: { type: Number },
    pieces: { type: Number },
    unitLabel: { type: String },
    priceForUnitLabel: { type: String }
    }],
    totalPrice: {
        type: Number,
        required: true
    },
    subtotalPrice: {
        type: Number,
        required: false
    },
    discountAmount: {
        type: Number,
        required: false,
        default: 0
    },
    couponCode: {
        type: String,
        required: false,
        uppercase: true,
        trim: true
    },
    deliveryFee: {
        type: Number,
        required: false,
        default: 0,
        min: 0,
    },
    freeDeliveryApplied: {
        type: Boolean,
        required: false,
        default: false,
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'delivered', 'cancelled'],
        default: 'pending'
    },
    paymentMode: {
        type: String,
        enum: ['COD'],
        default: 'COD'
    },
    // Snapshot of customer phone at checkout time
    customerPhone: {
        type: String,
        required: false,
        trim: true,
    },
    address: {
        houseNo: { type: String, default: '' },
        landmark: { type: String, default: '' },
        area: { type: String, default: '' },
        city: { type: String, default: 'Mysore' },
        state: { type: String, default: 'Karnataka' },
        pincode: { type: String, default: '' },
    },
    latitude: {
        type: Number,
    },
    longitude: {
        type: Number,
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    idempotencyKey: {
        type: String,
        required: false,
        index: true,
    }
});

// Ensure we don't create duplicate orders for the same user/key
orderSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Order', orderSchema);