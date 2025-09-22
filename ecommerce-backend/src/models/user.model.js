const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
    },
    password: {
        type: String,
        required: true,
    },
    phone: {
        type: String,
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user',
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
    cart: [
        {
            productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
            quantity: { type: Number, default: 1, min: 1 },
        }
    ],
    // Password reset token and expiry
    resetPasswordToken: {
        type: String,
    },
    resetPasswordExpires: {
        type: Date,
    },
    // OAuth fields
    provider: {
        type: String,
        enum: ['local', 'google'],
        default: 'local',
    },
    googleId: {
        type: String,
        index: true,
        sparse: true,
    },
    emailVerified: {
        type: Boolean,
        default: false,
    },
    picture: {
        type: String,
    },
}, { timestamps: true });

userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User;