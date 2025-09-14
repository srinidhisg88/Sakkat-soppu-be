const express = require('express');
const router = express.Router();
const { getProfile, updateProfile } = require('../controllers/farmer.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const adminMiddleware = require('../middlewares/admin.middleware');
const { uploadFields } = require('../services/cloudinary.service');

// Farmer profile routes (requires farmer auth)
router.get('/profile', authMiddleware, getProfile);
router.put('/profile', authMiddleware, uploadFields([{ name: 'images' }, { name: 'videos' }]), updateProfile);

// Farmer product creation (auth required and controller will associate farmerId)
const { validateProductCreate } = require('../utils/validators');
const productController = require('../controllers/products.controller');
router.post('/products', authMiddleware, uploadFields([{ name: 'images' }, { name: 'videos' }]), validateProductCreate, productController.createProduct);

module.exports = router;
