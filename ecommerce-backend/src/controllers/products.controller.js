const Product = require('../models/product.model');
const { cloudinaryUpload } = require('../services/cloudinary.service');
const { logAudit } = require('../services/audit.service');
const { handleError } = require('../middlewares/error.middleware');

// Create a new product
exports.createProduct = async (req, res) => {
    try {
    const { name, category, price, stock, description, isOrganic, g, pieces } = req.body;
        let imageUrl = null;
        const images = [];
        const videos = [];

        if (req.files) {
            if (req.files.images) {
                for (const f of req.files.images) {
                    const url = await cloudinaryUpload(f.path);
                    images.push(url);
                }
                imageUrl = images[0] || null;
            }
            if (req.files.videos) {
                for (const f of req.files.videos) {
                    const url = await cloudinaryUpload(f.path);
                    videos.push(url);
                }
            }
        } else if (req.file) {
            imageUrl = await cloudinaryUpload(req.file.path);
        }

        const productData = {
            name,
            category,
            price,
            stock,
            imageUrl,
            images,
            videos,
            description,
            isOrganic,
            g,
            pieces,
        };

        // If the creator is a farmer, associate product with farmerId
        if (req.user && req.user.role === 'farmer') {
            productData.farmerId = req.user.id;
        }

        const newProduct = new Product(productData);

    await newProduct.save();
    // Audit
    logAudit({ req, action: 'PRODUCT_CREATE', entityType: 'product', entityId: newProduct._id, before: null, after: { name: newProduct.name, price: newProduct.price, stock: newProduct.stock }, meta: {} });

    res.status(201).json({ message: 'Product created successfully', product: newProduct });
    } catch (error) {
        handleError(res, error);
    }
};

// Get all products with pagination and optional lowStock filter
exports.getProducts = async (req, res) => {
    try {
        let { page = 1, limit = 10, lowStock, threshold } = req.query;
        page = parseInt(page, 10) || 1;
        limit = parseInt(limit, 10) || 10;
        const query = {};
        if (String(lowStock) === 'true') {
            const th = Math.max(parseInt(threshold, 10) || 10, 0);
            query.stock = { $lte: th };
        }

        const [products, total] = await Promise.all([
            Product.find(query)
                .skip((page - 1) * limit)
                .limit(limit),
            Product.countDocuments(query)
        ]);

        res.status(200).json({ products, total, page, totalPages: Math.ceil(total / limit) });
    } catch (error) {
        handleError(res, error);
    }
};

// Get a single product by ID
exports.getProductById = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.status(200).json(product);
    } catch (error) {
        handleError(res, error);
    }
};

// Update a product by ID
exports.updateProduct = async (req, res) => {
    try {
    const { name, category, price, stock, description, isOrganic, g, pieces } = req.body;
    const updateData = { name, category, price, stock, description, isOrganic, g, pieces };

        if (req.files) {
            if (req.files.images) {
                updateData.images = [];
                for (const f of req.files.images) {
                    const url = await cloudinaryUpload(f.path);
                    updateData.images.push(url);
                }
                updateData.imageUrl = updateData.images[0] || updateData.imageUrl;
            }
            if (req.files.videos) {
                updateData.videos = [];
                for (const f of req.files.videos) {
                    const url = await cloudinaryUpload(f.path);
                    updateData.videos.push(url);
                }
            }
        } else if (req.file) {
            updateData.imageUrl = await cloudinaryUpload(req.file.path);
        }

        // Ensure ownership: if farmer, they can only update their own product
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ message: 'Product not found' });

        if (req.user && req.user.role === 'farmer' && String(product.farmerId) !== String(req.user.id)) {
            return res.status(403).json({ message: 'Forbidden. Cannot edit another farmer\'s product.' });
        }

        const updatedProduct = await Product.findByIdAndUpdate(req.params.id, updateData, { new: true });
        if (!updatedProduct) {
            return res.status(404).json({ message: 'Product not found' });
        }
        // Audit
        try {
            logAudit({ req, action: 'PRODUCT_UPDATE', entityType: 'product', entityId: updatedProduct._id, before: { name: product.name, price: product.price, stock: product.stock }, after: { name: updatedProduct.name, price: updatedProduct.price, stock: updatedProduct.stock }, meta: {} });
        } catch (_) {}
        res.status(200).json({ message: 'Product updated successfully', product: updatedProduct });
    } catch (error) {
        handleError(res, error);
    }
};

// Delete a product by ID
exports.deleteProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ message: 'Product not found' });

        if (req.user && req.user.role === 'farmer' && String(product.farmerId) !== String(req.user.id)) {
            return res.status(403).json({ message: 'Forbidden. Cannot delete another farmer\'s product.' });
        }

        await Product.findByIdAndDelete(req.params.id);
        // Audit
        try {
            logAudit({ req, action: 'PRODUCT_DELETE', entityType: 'product', entityId: product._id, before: { name: product.name, price: product.price, stock: product.stock }, after: null, meta: {} });
        } catch (_) {}
        res.status(200).json({ message: 'Product deleted successfully' });
    } catch (error) {
        handleError(res, error);
    }
};