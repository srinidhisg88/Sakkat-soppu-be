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
        fileSize: 500 * 1024 * 1024  // 500MB limit
    }
});

const homeVideosController = require('../controllers/homeVideos.controller');
const auth = require('../middlewares/auth.middleware');
const adminMiddleware = require('../middlewares/admin.middleware');

// List all videos (admin view)
router.get('/', auth.authenticate, adminMiddleware, homeVideosController.listVideos);

// Add new video
router.post('/' ,
    auth.authenticate,
    adminMiddleware,
    upload.fields([
        { name: 'video', maxCount: 1 }
    ]),
    homeVideosController.addVideo
);

// Update video details
router.put('/:id' , auth.authenticate, adminMiddleware, homeVideosController.updateVideo);

// Delete video
router.delete('/:id' , auth.authenticate, adminMiddleware, homeVideosController.deleteVideo);

// Reorder videos
router.post('/reorder', auth.authenticate, adminMiddleware, homeVideosController.reorderVideos);

module.exports = router;