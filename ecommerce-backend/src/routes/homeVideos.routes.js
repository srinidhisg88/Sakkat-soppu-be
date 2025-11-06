const express = require('express');
const router = express.Router();
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { cloudinary } = require('../services/cloudinary.service');

// Configure Cloudinary storage for homepage videos
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'homepage_videos',  // Separate folder for homepage videos
        resource_type: 'video',
        allowed_formats: ['mp4', 'mov', 'webm'],  // Common web-compatible formats
        timeout: 600000  // 10 minutes for larger video files
    }
});

const upload = multer({ 
    storage,
    limits: {
        fileSize: 100 * 1024 * 1024  // 100MB limit
    }
});

const homeVideosController = require('../controllers/homeVideos.controller');
const roleMiddleware = require('../middlewares/role.middleware');

// List all videos (admin view)
router.get('/', roleMiddleware(['admin']), homeVideosController.listVideos);

// Add new video
router.post('/',
    roleMiddleware(['admin']),
    upload.fields([
        { name: 'video', maxCount: 1 }
    ]),
    homeVideosController.addVideo
);

// Update video details
router.put('/:id', roleMiddleware(['admin']), homeVideosController.updateVideo);

// Delete video
router.delete('/:id', roleMiddleware(['admin']), homeVideosController.deleteVideo);

// Reorder videos
router.post('/reorder', roleMiddleware(['admin']), homeVideosController.reorderVideos);

module.exports = router;