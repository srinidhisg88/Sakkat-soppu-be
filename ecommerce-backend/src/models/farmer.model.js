const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const farmerSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    phone: { type: String },
    address: { type: String },
    farmName: { type: String },
    farmDescription: { type: String },
    farmImages: [{ type: String }], // cloudinary urls
    farmVideos: [{ type: String }],
    latitude: { type: Number },
    longitude: { type: Number },
    role: { type: String, enum: ['farmer'], default: 'farmer' },
}, { timestamps: true });

farmerSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

farmerSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('Farmer', farmerSchema);
