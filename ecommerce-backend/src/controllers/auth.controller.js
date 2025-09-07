const User = require('../models/user.model');
const Farmer = require('../models/farmer.model');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { sendEmail } = require('../services/email.service');
// Previously used getGeocode; now prefer device-provided lat/lng
const logger = require('../config/logger');

// User signup
exports.signup = async (req, res) => {
    try {
        const { name, email, password, phone, address, latitude, longitude } = req.body;

        const existing = await User.findOne({ email });
        if (existing) return res.status(409).json({ message: 'Email already in use' });

        const hashedPassword = await bcrypt.hash(password, 10);

    // Prefer device-provided coordinates. Frontend should send latitude & longitude when available.
    const newUser = new User({ name, email, password: hashedPassword, phone, address, latitude: latitude || null, longitude: longitude || null });

        await newUser.save();
        res.status(201).json({ message: 'User created successfully' });
    } catch (error) {
        logger.error('Signup error: ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// User login
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        // Try finding a normal user first
        let user = await User.findOne({ email });
        let roleSource = 'user';

        if (!user) {
            // try farmer
            user = await Farmer.findOne({ email });
            roleSource = 'farmer';
        }

        if (!user) return res.status(401).json({ message: 'Invalid credentials' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

        const role = roleSource === 'farmer' ? 'farmer' : user.role;
        const token = jwt.sign({ id: user._id, role, email: user.email }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.status(200).json({ token, user: { id: user._id, name: user.name, email: user.email, role } });
    } catch (error) {
        logger.error('Login error: ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};