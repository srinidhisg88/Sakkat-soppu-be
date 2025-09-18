const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    // Backward compatible category name (will mirror from Category on write)
    category: {
        type: String,
        required: true,
    },
    // New normalized reference
    categoryId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        required: false,
        index: true,
    },
    price: {
        type: Number,
        required: true,
    },
    // Optional unit markers for pricing context
    g: {
        type: Number,
        required: false,
        min: 0,
    },
    pieces: {
        type: Number,
        required: false,
        min: 0,
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
    // Store Cloudinary public_ids in parallel arrays to enable precise deletions (not required by frontend)
    imagesPublicIds: [{ type: String }],
    videos: [{ type: String }],
    videosPublicIds: [{ type: String }],
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

// Include virtuals when converting to JSON/Objects
productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

// Computed: price per kg if price corresponds to `g` grams
productSchema.virtual('pricePerKg').get(function () {
    const price = this.price;
    const grams = this.g;
    if (typeof price !== 'number' || typeof grams !== 'number' || grams <= 0) return null;
    const perKg = (price / grams) * 1000;
    return Number(perKg.toFixed(2));
});

// Computed: price per piece if price corresponds to `pieces` count
productSchema.virtual('pricePerPiece').get(function () {
    const price = this.price;
    const pcs = this.pieces;
    if (typeof price !== 'number' || typeof pcs !== 'number' || pcs <= 0) return null;
    const per = price / pcs;
    return Number(per.toFixed(2));
});

// Computed: primary unit label for display
productSchema.virtual('unitLabel').get(function () {
    if (typeof this.g === 'number' && this.g > 0) {
        const grams = this.g;
        if (grams >= 1000) {
            const kg = grams / 1000;
            // format up to 2 decimals and trim trailing zeros
            const formatted = (Math.round(kg * 100) / 100).toString();
            return `${formatted.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1')} kg`;
        }
        return `${grams} g`;
    }
    if (typeof this.pieces === 'number' && this.pieces > 0) return `${this.pieces} pcs`;
    return null;
});

// Convenience: "{price} for {unitLabel}" (currency formatting left to frontend)
productSchema.virtual('priceForUnitLabel').get(function () {
    const unit = this.unitLabel;
    if (!unit || typeof this.price !== 'number') return null;
    return `${this.price} for ${unit}`;
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;