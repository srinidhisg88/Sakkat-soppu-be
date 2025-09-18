const mongoose = require('mongoose');

// Decoupled Farmer profile (no auth credentials)
const farmerSchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: String },
    address: { type: String },
    farmName: { type: String },
    farmDescription: { type: String },
    // Media URLs
    farmImages: [{ type: String }],
    farmVideos: [{ type: String }],
    // Cloudinary public_ids for deletions/reorders (parallel to URLs)
    farmImagesPublicIds: [{ type: String }],
    farmVideosPublicIds: [{ type: String }],
    latitude: { type: Number },
    longitude: { type: Number },
}, { timestamps: true });

module.exports = mongoose.model('Farmer', farmerSchema);
