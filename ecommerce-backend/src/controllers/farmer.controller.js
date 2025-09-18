const Farmer = require('../models/farmer.model');
const logger = require('../config/logger');
const { deleteAsset } = require('../services/cloudinary.service');

// Helper to parse arrays from repeated fields or JSON strings
const parseArray = (v) => {
    if (v == null) return [];
    if (Array.isArray(v)) return v.filter(Boolean);
    try { const arr = JSON.parse(v); return Array.isArray(arr) ? arr : []; } catch { return [v].filter(Boolean); }
};

// Admin: create farmer profile (no credentials)
exports.adminCreateFarmer = async (req, res) => {
    try {
        const { name, phone, address, farmName, farmDescription, latitude, longitude } = req.body;

        const farmImages = [];
        const farmImagesPublicIds = [];
        const farmVideos = [];
        const farmVideosPublicIds = [];

        if (req.files && Array.isArray(req.files.images)) {
            for (const f of req.files.images) {
                const url = f.path || f.secure_url;
                const publicId = f.filename || (f.public_id || undefined);
                if (url) farmImages.push(url);
                if (publicId) farmImagesPublicIds.push(publicId);
            }
        }
        if (req.files && Array.isArray(req.files.videos)) {
            for (const f of req.files.videos) {
                const url = f.path || f.secure_url;
                const publicId = f.filename || (f.public_id || undefined);
                if (url) farmVideos.push(url);
                if (publicId) farmVideosPublicIds.push(publicId);
            }
        }

        const farmer = new Farmer({
            name, phone, address, farmName, farmDescription, latitude, longitude,
            farmImages, farmImagesPublicIds, farmVideos, farmVideosPublicIds,
        });
        await farmer.save();
        res.status(201).json({ message: 'Farmer created', farmer });
    } catch (err) {
        logger.error('Error creating farmer', err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Admin: update farmer with media management
exports.adminUpdateFarmer = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, phone, address, farmName, farmDescription, latitude, longitude } = req.body;
        const farmer = await Farmer.findById(id);
        if (!farmer) return res.status(404).json({ message: 'Farmer not found' });

        let images = Array.isArray(farmer.farmImages) ? [...farmer.farmImages] : [];
        let imagesP = Array.isArray(farmer.farmImagesPublicIds) ? [...farmer.farmImagesPublicIds] : [];
        let videos = Array.isArray(farmer.farmVideos) ? [...farmer.farmVideos] : [];
        let videosP = Array.isArray(farmer.farmVideosPublicIds) ? [...farmer.farmVideosPublicIds] : [];

        const removeImages = parseArray(req.body.removeImages);
        const removeVideos = parseArray(req.body.removeVideos);
        const imagesOrder = parseArray(req.body.imagesOrder);
        const videosOrder = parseArray(req.body.videosOrder);

        if (removeImages.length) {
            const toDeleteIdx = [];
            images = images.filter((url, idx) => {
                const keep = !removeImages.includes(url);
                if (!keep) toDeleteIdx.push(idx);
                return keep;
            });
            for (const idx of toDeleteIdx) {
                const pid = imagesP[idx];
                if (pid) deleteAsset(pid, 'image');
            }
            imagesP = imagesP.filter((_, idx) => !toDeleteIdx.includes(idx));
        }
        if (removeVideos.length) {
            const toDeleteIdx = [];
            videos = videos.filter((url, idx) => {
                const keep = !removeVideos.includes(url);
                if (!keep) toDeleteIdx.push(idx);
                return keep;
            });
            for (const idx of toDeleteIdx) {
                const pid = videosP[idx];
                if (pid) deleteAsset(pid, 'video');
            }
            videosP = videosP.filter((_, idx) => !toDeleteIdx.includes(idx));
        }

        // Append new uploads
        if (req.files && Array.isArray(req.files.images)) {
            for (const f of req.files.images) {
                const url = f.path || f.secure_url;
                const publicId = f.filename || (f.public_id || undefined);
                if (url) images.push(url);
                if (publicId) imagesP.push(publicId);
            }
        }
        if (req.files && Array.isArray(req.files.videos)) {
            for (const f of req.files.videos) {
                const url = f.path || f.secure_url;
                const publicId = f.filename || (f.public_id || undefined);
                if (url) videos.push(url);
                if (publicId) videosP.push(publicId);
            }
        }

        // Reorder
        if (imagesOrder.length) {
            const orderSet = new Set(imagesOrder);
            const ordered = [];
            const orderedP = [];
            const map = new Map(images.map((u, i) => [u, i]));
            for (const url of imagesOrder) {
                if (map.has(url)) {
                    const idx = map.get(url);
                    ordered.push(images[idx]);
                    orderedP.push(imagesP[idx]);
                }
            }
            images.forEach((u, i) => { if (!orderSet.has(u)) { ordered.push(u); orderedP.push(imagesP[i]); } });
            images = ordered; imagesP = orderedP;
        }
        if (videosOrder.length) {
            const orderSet = new Set(videosOrder);
            const ordered = [];
            const orderedP = [];
            const map = new Map(videos.map((u, i) => [u, i]));
            for (const url of videosOrder) {
                if (map.has(url)) {
                    const idx = map.get(url);
                    ordered.push(videos[idx]);
                    orderedP.push(videosP[idx]);
                }
            }
            videos.forEach((u, i) => { if (!orderSet.has(u)) { ordered.push(u); orderedP.push(videosP[i]); } });
            videos = ordered; videosP = orderedP;
        }

        const update = { name, phone, address, farmName, farmDescription, latitude, longitude };
        Object.keys(update).forEach(k => update[k] === undefined && delete update[k]);
        update.farmImages = images;
        update.farmImagesPublicIds = imagesP;
        update.farmVideos = videos;
        update.farmVideosPublicIds = videosP;

        const updated = await Farmer.findByIdAndUpdate(id, update, { new: true });
        res.status(200).json({ message: 'Farmer updated', farmer: updated });
    } catch (err) {
        logger.error('Error updating farmer', err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Admin: delete farmer
exports.adminDeleteFarmer = async (req, res) => {
    try {
        const { id } = req.params;
        // Fetch for asset cleanup
        const doc = await Farmer.findById(id);
        if (!doc) return res.status(404).json({ message: 'Farmer not found' });
        // Best-effort delete of media assets
        try {
            const imgs = Array.isArray(doc.farmImagesPublicIds) ? doc.farmImagesPublicIds : [];
            const vids = Array.isArray(doc.farmVideosPublicIds) ? doc.farmVideosPublicIds : [];
            for (const pid of imgs) { if (pid) await deleteAsset(pid, 'image'); }
            for (const pid of vids) { if (pid) await deleteAsset(pid, 'video'); }
        } catch (e) {
            logger.warn('Farmer asset cleanup failed', e);
        }
        const deleted = await Farmer.findByIdAndDelete(id);
        if (!deleted) return res.status(404).json({ message: 'Farmer not found' });
        res.status(200).json({ message: 'Farmer deleted' });
    } catch (err) {
        logger.error('Error deleting farmer', err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Admin: list and get
exports.adminListFarmers = async (req, res) => {
    try {
        let { page = 1, limit = 10, q } = req.query;
        page = parseInt(page, 10) || 1;
        limit = parseInt(limit, 10) || 10;
        const query = q ? { $or: [
            { name: new RegExp(q, 'i') },
            { farmName: new RegExp(q, 'i') },
        ] } : {};
        const [farmers, total] = await Promise.all([
            Farmer.find(query).skip((page - 1) * limit).limit(limit),
            Farmer.countDocuments(query)
        ]);
        res.status(200).json({ farmers, total, page, totalPages: Math.ceil(total / limit) });
    } catch (err) {
        logger.error('Error listing farmers', err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.adminGetFarmer = async (req, res) => {
    try {
        const farmer = await Farmer.findById(req.params.id);
        if (!farmer) return res.status(404).json({ message: 'Farmer not found' });
        res.status(200).json(farmer);
    } catch (err) {
        logger.error('Error fetching farmer', err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Public list/get
exports.listPublicFarmers = async (req, res) => {
    try {
        let { page = 1, limit = 10, q } = req.query;
        page = parseInt(page, 10) || 1;
        limit = parseInt(limit, 10) || 10;
        const query = q ? { $or: [
            { name: new RegExp(q, 'i') },
            { farmName: new RegExp(q, 'i') },
        ] } : {};
        const [farmers, total] = await Promise.all([
            Farmer.find(query).skip((page - 1) * limit).limit(limit),
            Farmer.countDocuments(query)
        ]);
        res.status(200).json({ farmers, total, page, totalPages: Math.ceil(total / limit) });
    } catch (err) {
        logger.error('Error listing public farmers', err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

exports.getPublicFarmer = async (req, res) => {
    try {
        const farmer = await Farmer.findById(req.params.id);
        if (!farmer) return res.status(404).json({ message: 'Farmer not found' });
        res.status(200).json(farmer);
    } catch (err) {
        logger.error('Error fetching public farmer', err);
        res.status(500).json({ message: 'Internal server error' });
    }
};
