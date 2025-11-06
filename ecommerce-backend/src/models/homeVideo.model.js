const mongoose = require('mongoose');

const homeVideoSchema = new mongoose.Schema({
    title: {
        type: String,
        trim: true,
        default: ''
    },
    videoUrl: {
        type: String,
        required: true
    },
    videoPublicId: {
        type: String,
        required: true
    },
    displayOrder: {
        type: Number,
        default: 0  // Videos will be ordered by this field (ascending)
    },
    active: {
        type: Boolean,
        default: true  // To soft-disable videos without deleting
    }
}, { timestamps: true });

// Add index on displayOrder for efficient sorting
homeVideoSchema.index({ displayOrder: 1 });

// Add index on active status for efficient filtering
homeVideoSchema.index({ active: 1 });

// Helper method to reorder videos
homeVideoSchema.statics.reorderVideos = async function(videoIds) {
    const bulkOps = videoIds.map((videoId, index) => ({
        updateOne: {
            filter: { _id: videoId },
            update: { $set: { displayOrder: index } }
        }
    }));

    return this.bulkWrite(bulkOps);
};

const HomeVideo = mongoose.model('HomeVideo', homeVideoSchema);

module.exports = HomeVideo;