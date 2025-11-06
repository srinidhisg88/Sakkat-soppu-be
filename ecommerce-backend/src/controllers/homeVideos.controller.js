const HomeVideo = require('../models/homeVideo.model');
const { cloudinary, deleteAsset } = require('../services/cloudinary.service');
const { logAudit } = require('../services/audit.service');
const { handleError } = require('../middlewares/error.middleware');

// List all home videos (admin)
exports.listVideos = async (req, res) => {
    try {
        const videos = await HomeVideo.find()
            .sort('displayOrder')
            .lean();
        
        res.status(200).json({ data: videos });
    } catch (error) {
        handleError(res, error);
    }
};

// Add new home video
exports.addVideo = async (req, res) => {
    try {
        const { title } = req.body;

        // Handle video upload
        if (!req.files || !req.files.video) {
            return res.status(400).json({ message: 'Video file is required' });
        }

        const videoFile = req.files.video[0];
        if (!videoFile.path) {
            return res.status(400).json({ message: 'Video upload failed' });
        }

        // Get the highest displayOrder
        const lastVideo = await HomeVideo.findOne()
            .sort('-displayOrder')
            .select('displayOrder')
            .lean();
        
        const displayOrder = lastVideo ? lastVideo.displayOrder + 1 : 0;

        const newVideo = new HomeVideo({
            title: title || '',
            videoUrl: videoFile.path,
            videoPublicId: videoFile.filename,
            displayOrder
        });

        await newVideo.save();

        // Audit
        logAudit({
            req,
            action: 'HOME_VIDEO_ADD',
            entityType: 'homeVideo',
            entityId: newVideo._id,
            before: null,
            after: newVideo.toObject(),
            meta: {}
        });

        res.status(201).json({
            message: 'Video added successfully',
            video: newVideo
        });
    } catch (error) {
        handleError(res, error);
    }
};

// Update video title or order
exports.updateVideo = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, active } = req.body;

        const video = await HomeVideo.findById(id);
        if (!video) {
            return res.status(404).json({ message: 'Video not found' });
        }

        const updates = {};
        if (title !== undefined) updates.title = title;
        if (active !== undefined) updates.active = active;

        const before = video.toObject();
        const updated = await HomeVideo.findByIdAndUpdate(
            id,
            updates,
            { new: true }
        );

        // Audit
        logAudit({
            req,
            action: 'HOME_VIDEO_UPDATE',
            entityType: 'homeVideo',
            entityId: video._id,
            before,
            after: updated.toObject(),
            meta: {}
        });

        res.status(200).json({
            message: 'Video updated successfully',
            video: updated
        });
    } catch (error) {
        handleError(res, error);
    }
};

// Delete video
exports.deleteVideo = async (req, res) => {
    try {
        const { id } = req.params;

        const video = await HomeVideo.findById(id);
        if (!video) {
            return res.status(404).json({ message: 'Video not found' });
        }

        // Delete from Cloudinary
        if (video.videoPublicId) {
            await deleteAsset(video.videoPublicId, 'video');
        }

        // Delete from database
        await video.deleteOne();

        // Audit
        logAudit({
            req,
            action: 'HOME_VIDEO_DELETE',
            entityType: 'homeVideo',
            entityId: video._id,
            before: video.toObject(),
            after: null,
            meta: {}
        });

        res.status(200).json({
            message: 'Video deleted successfully'
        });
    } catch (error) {
        handleError(res, error);
    }
};

// Reorder videos
exports.reorderVideos = async (req, res) => {
    try {
        const { videoIds } = req.body;

        if (!Array.isArray(videoIds)) {
            return res.status(400).json({
                message: 'videoIds must be an array'
            });
        }

        // Verify all videos exist
        const videos = await HomeVideo.find({
            _id: { $in: videoIds }
        });

        if (videos.length !== videoIds.length) {
            return res.status(400).json({
                message: 'All video IDs must be valid'
            });
        }

        await HomeVideo.reorderVideos(videoIds);

        res.status(200).json({
            message: 'Videos reordered successfully'
        });
    } catch (error) {
        handleError(res, error);
    }
};

// List active videos (public API)
exports.listPublicVideos = async (req, res) => {
    try {
        const videos = await HomeVideo.find({ active: true })
            .sort('displayOrder')
            .select('-videoPublicId')  // Don't expose Cloudinary IDs
            .lean();
        
        res.status(200).json({ data: videos });
    } catch (error) {
        handleError(res, error);
    }
};