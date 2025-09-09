const Farmer = require('../models/farmer.model');
const logger = require('../config/logger');
const bcrypt = require('bcrypt');
const { cloudinaryUpload } = require('../services/cloudinary.service');

// Admin: create a farmer account (returns temporary credentials)
exports.createFarmer = async (req, res) => {
    try {
        const { name, email, password, phone, address, farmName, farmDescription, latitude, longitude } = req.body;
        const existing = await Farmer.findOne({ email });
        if (existing) return res.status(409).json({ message: 'Farmer email already exists' });

    const tempPassword = password || Math.random().toString(36).slice(-8);
    // Do not pre-hash; model pre-save hook will hash
    const farmer = new Farmer({ name, email, password: tempPassword, phone, address, farmName, farmDescription, latitude, longitude });
        await farmer.save();

        // Send credentials to farmer via email and SMS (best-effort)
        try {
            const { sendFarmerCredentials } = require('../services/email.service');
            await sendFarmerCredentials(email, { email, password: tempPassword });
        } catch (err) {
            logger.error('Error sending farmer credentials email', err);
        }

        try {
            if (phone) {
                const { sendSmsToAdmin } = require('../services/sms.service');
                // send to farmer phone the login credentials
                await sendSmsToAdmin(phone, `Your farmer account was created. Login: ${email} Password: ${tempPassword}`);
            }
        } catch (err) {
            logger.error('Error sending farmer credentials SMS', err);
        }

        // return temporary credentials to admin (also returned) so they can pass to farmer if needed
        res.status(201).json({ message: 'Farmer created', credentials: { email, password: tempPassword } });
    } catch (err) {
        logger.error('Error creating farmer', err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Admin: update farmer
exports.updateFarmer = async (req, res) => {
    try {
        const { id } = req.params;
        const update = req.body;
    if (update.password) update.password = await bcrypt.hash(update.password, 10); // necessary here, pre-save hook not triggered by findByIdAndUpdate
        const farmer = await Farmer.findByIdAndUpdate(id, update, { new: true });
        if (!farmer) return res.status(404).json({ message: 'Farmer not found' });
        res.status(200).json({ message: 'Farmer updated', farmer });
    } catch (err) {
        logger.error('Error updating farmer', err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Admin: delete farmer
exports.deleteFarmer = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await Farmer.findByIdAndDelete(id);
        if (!deleted) return res.status(404).json({ message: 'Farmer not found' });
        res.status(200).json({ message: 'Farmer deleted' });
    } catch (err) {
        logger.error('Error deleting farmer', err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Farmer: get own profile
exports.getProfile = async (req, res) => {
    try {
        const farmerId = req.user.id;
        const farmer = await Farmer.findById(farmerId).select('-password');
        if (!farmer) return res.status(404).json({ message: 'Farmer not found' });
        res.status(200).json(farmer);
    } catch (err) {
        logger.error('Error fetching farmer profile', err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Farmer: update own profile (allow farm images/videos via cloudinary)
exports.updateProfile = async (req, res) => {
    try {
        const farmerId = req.user.id;
        const update = { ...req.body };

        // handle images/videos in req.files if provided
            if (req.files) {
                if (req.files.images) {
                    const saved = [];
                    for (const f of req.files.images) {
                        const url = await cloudinaryUpload(f.path);
                        saved.push(url);
                    }
                    update.farmImages = saved;
                }
                if (req.files.videos) {
                    const savedV = [];
                    for (const f of req.files.videos) {
                        const url = await cloudinaryUpload(f.path);
                        savedV.push(url);
                    }
                    update.farmVideos = savedV;
                }
        }

        const farmer = await Farmer.findByIdAndUpdate(farmerId, update, { new: true }).select('-password');
        res.status(200).json({ message: 'Profile updated', farmer });
    } catch (err) {
        logger.error('Error updating profile', err);
        res.status(500).json({ message: 'Internal server error' });
    }
};
