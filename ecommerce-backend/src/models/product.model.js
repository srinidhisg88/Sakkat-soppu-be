const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    category: {
        type: String,
        required: true,
    },
    price: {
        type: Number,
        required: true,
    },
    stock: {
        type: Number,
        required: true,
        min: 0,
    },
    imageUrl: {
        type: String,
        required: true,
    },
    images: [{ type: String }],
    videos: [{ type: String }],
    description: {
        type: String,
        required: true,
    },
    isOrganic: {
        type: Boolean,
        default: false,
    },
    farmerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Farmer',
    },
}, { timestamps: true });

const Product = mongoose.model('Product', productSchema);

module.exports = Product;