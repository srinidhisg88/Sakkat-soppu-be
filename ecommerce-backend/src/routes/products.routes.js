const express = require('express');
const { createProduct, getProducts, getProductById, updateProduct, deleteProduct } = require('../controllers/products.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const { uploadFields } = require('../services/cloudinary.service');
const adminMiddleware = require('../middlewares/admin.middleware');
const { validateProduct } = require('../utils/validators');

const router = express.Router();

// Create a new product (admin or farmer) — controller enforces farmer ownership
router.post('/', authMiddleware,adminMiddleware, uploadFields([{ name: 'images' }, { name: 'videos' }]), validateProduct, createProduct);

// Get all products with optional pagination
router.get('/', getProducts);

// Get a single product by ID
router.get('/:id', getProductById);

// Update a product by ID (admin or owning farmer)
router.put('/:id', authMiddleware, uploadFields([{ name: 'images' }, { name: 'videos' }]), validateProduct, updateProduct);

// Delete a product by ID (admin or owning farmer)
router.delete('/:id', authMiddleware, deleteProduct);

module.exports = router;