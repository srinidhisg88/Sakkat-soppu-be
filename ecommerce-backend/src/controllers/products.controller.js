const Product = require('../models/product.model');
const { cloudinary, deleteAsset } = require('../services/cloudinary.service');
const { logAudit } = require('../services/audit.service');
const { handleError } = require('../middlewares/error.middleware');

// Create a new product
exports.createProduct = async (req, res) => {
    try {
    const { name, category, categoryId, price, stock, description, isOrganic } = req.body;
        // Prefer one of g or pieces; last non-zero wins
        let g = Number(req.body.g || 0) || 0;
        let pieces = Number(req.body.pieces || 0) || 0;
        if (g > 0 && pieces > 0) {
            // keep the last non-zero sent by client
            if (String(req.body.pieces).trim() !== '') { g = 0; }
            else { pieces = 0; }
        } else if (g > 0) {
            pieces = 0;
        } else if (pieces > 0) {
            g = 0;
        }

        let imageUrl = null;
        const images = [];
        const imagesPublicIds = [];
        const videos = [];
        const videosPublicIds = [];

        // New uploads via multer-storage-cloudinary provide path and also file.filename/public_id via storage engine
        if (req.files && Array.isArray(req.files.images)) {
            for (const f of req.files.images) {
                // multer-storage-cloudinary exposes 'path' as URL and 'filename' as public_id
                const url = f.path || f.secure_url;
                const publicId = f.filename || (f.public_id || undefined);
                if (url) images.push(url);
                if (publicId) imagesPublicIds.push(publicId);
            }
            imageUrl = images[0] || null;
        }
        if (req.files && Array.isArray(req.files.videos)) {
            for (const f of req.files.videos) {
                const url = f.path || f.secure_url;
                const publicId = f.filename || (f.public_id || undefined);
                if (url) videos.push(url);
                if (publicId) videosPublicIds.push(publicId);
            }
        }

        const productData = {
            name,
            category,
            categoryId,
            price,
            stock,
            imageUrl,
            images,
            imagesPublicIds,
            videos,
            videosPublicIds,
            description,
            isOrganic,
            g,
            pieces,
        };

        // If categoryId provided, mirror the Category.name into string category
        if (categoryId && !category) {
            try {
                const Category = require('../models/category.model');
                const c = await Category.findById(categoryId).select('name');
                if (c) productData.category = c.name;
            } catch (_) {}
        }

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
    const { name, category, categoryId, price, stock, description, isOrganic } = req.body;
    // Normalize g/pieces: prefer the last non-zero, zero-out the other
    let g = Number(req.body.g || 0) || 0;
    let pieces = Number(req.body.pieces || 0) || 0;
    if (g > 0 && pieces > 0) {
        if (String(req.body.pieces).trim() !== '') { g = 0; } else { pieces = 0; }
    } else if (g > 0) { pieces = 0; } else if (pieces > 0) { g = 0; }
    const updateData = { name, category, categoryId, price, stock, description, isOrganic, g, pieces };

        // Load product for media editing
        const product = await Product.findById(req.params.id);
        if (!product) return res.status(404).json({ message: 'Product not found' });

        // Ownership check
        if (req.user && req.user.role === 'farmer' && String(product.farmerId) !== String(req.user.id)) {
            return res.status(403).json({ message: 'Forbidden. Cannot edit another farmer\'s product.' });
        }

        // Parse arrays possibly provided as repeated fields or JSON strings
        const parseArray = (v) => {
            if (v == null) return [];
            if (Array.isArray(v)) return v.filter(Boolean);
            try { const arr = JSON.parse(v); return Array.isArray(arr) ? arr : []; } catch { return [v].filter(Boolean); }
        };

    const removeImages = parseArray(req.body.removeImages);
    const removeVideos = parseArray(req.body.removeVideos);
    const imagesOrder = parseArray(req.body.imagesOrder);
    const videosOrder = parseArray(req.body.videosOrder);

        // Start with existing media
        let newImages = Array.isArray(product.images) ? [...product.images] : [];
        let newImagesPublicIds = Array.isArray(product.imagesPublicIds) ? [...product.imagesPublicIds] : [];
        let newVideos = Array.isArray(product.videos) ? [...product.videos] : [];
        let newVideosPublicIds = Array.isArray(product.videosPublicIds) ? [...product.videosPublicIds] : [];

        // Remove requested images/videos by URL match
        if (removeImages.length) {
            const toDeleteIdx = [];
            newImages = newImages.filter((url, idx) => {
                const keep = !removeImages.includes(url);
                if (!keep) toDeleteIdx.push(idx);
                return keep;
            });
            // delete corresponding public_ids (best-effort)
            for (const idx of toDeleteIdx) {
                const pid = newImagesPublicIds[idx];
                if (pid) deleteAsset(pid, 'image');
            }
            newImagesPublicIds = newImagesPublicIds.filter((_, idx) => !toDeleteIdx.includes(idx));
        }
        if (removeVideos.length) {
            const toDeleteIdx = [];
            newVideos = newVideos.filter((url, idx) => {
                const keep = !removeVideos.includes(url);
                if (!keep) toDeleteIdx.push(idx);
                return keep;
            });
            for (const idx of toDeleteIdx) {
                const pid = newVideosPublicIds[idx];
                if (pid) deleteAsset(pid, 'video');
            }
            newVideosPublicIds = newVideosPublicIds.filter((_, idx) => !toDeleteIdx.includes(idx));
        }

        // Append new uploads, if any
        if (req.files && Array.isArray(req.files.images)) {
            for (const f of req.files.images) {
                const url = f.path || f.secure_url;
                const publicId = f.filename || (f.public_id || undefined);
                if (url) newImages.push(url);
                if (publicId) newImagesPublicIds.push(publicId);
            }
        }
        if (req.files && Array.isArray(req.files.videos)) {
            for (const f of req.files.videos) {
                const url = f.path || f.secure_url;
                const publicId = f.filename || (f.public_id || undefined);
                if (url) newVideos.push(url);
                if (publicId) newVideosPublicIds.push(publicId);
            }
        }

        // Reorder images if imagesOrder provided
        if (imagesOrder.length) {
            const orderSet = new Set(imagesOrder);
            const ordered = [];
            const orderedPids = [];
            // map from URL to indices (in case duplicates; we preserve first match behavior)
            const mapUrlToIndex = new Map(newImages.map((u, i) => [u, i]));
            for (const url of imagesOrder) {
                if (mapUrlToIndex.has(url)) {
                    const idx = mapUrlToIndex.get(url);
                    ordered.push(newImages[idx]);
                    orderedPids.push(newImagesPublicIds[idx]);
                }
            }
            // append remaining that were not explicitly ordered
            newImages.forEach((u, i) => { if (!orderSet.has(u)) { ordered.push(u); orderedPids.push(newImagesPublicIds[i]); } });
            newImages = ordered;
            newImagesPublicIds = orderedPids;
        }

        // Reorder videos if videosOrder provided
        if (videosOrder.length) {
            const orderSet = new Set(videosOrder);
            const ordered = [];
            const orderedPids = [];
            const mapUrlToIndex = new Map(newVideos.map((u, i) => [u, i]));
            for (const url of videosOrder) {
                if (mapUrlToIndex.has(url)) {
                    const idx = mapUrlToIndex.get(url);
                    ordered.push(newVideos[idx]);
                    orderedPids.push(newVideosPublicIds[idx]);
                }
            }
            newVideos.forEach((u, i) => { if (!orderSet.has(u)) { ordered.push(u); orderedPids.push(newVideosPublicIds[i]); } });
            newVideos = ordered;
            newVideosPublicIds = orderedPids;
        }

        // Primary image logic
        const newPrimary = req.body.imageUrl; // optional string
        if (typeof newPrimary === 'string' && newPrimary.trim()) {
            if (newImages.includes(newPrimary)) {
                updateData.imageUrl = newPrimary;
            } else if (newImages.length > 0) {
                updateData.imageUrl = newImages[0];
            } else {
                updateData.imageUrl = null;
            }
        } else {
            // if current primary was removed, fallback to first
            if (!newImages.includes(product.imageUrl || '')) {
                updateData.imageUrl = newImages[0] || null;
            }
        }

        updateData.images = newImages;
        updateData.imagesPublicIds = newImagesPublicIds;
        updateData.videos = newVideos;
        updateData.videosPublicIds = newVideosPublicIds;

        // If switching to categoryId (and no category provided), mirror name
        if (categoryId && !category) {
            try {
                const Category = require('../models/category.model');
                const c = await Category.findById(categoryId).select('name');
                if (c) updateData.category = c.name;
            } catch (_) {}
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