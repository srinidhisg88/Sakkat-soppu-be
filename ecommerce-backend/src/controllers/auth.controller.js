const User = require('../models/user.model');
const Farmer = require('../models/farmer.model');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { sendEmail, sendPasswordReset } = require('../services/email.service');
// Previously used getGeocode; now prefer device-provided lat/lng
const logger = require('../config/logger');

// User signup
exports.signup = async (req, res) => {
    try {
        const { name, email, password, phone, address, latitude, longitude } = req.body;

        const existing = await User.findOne({ email });
        if (existing) return res.status(409).json({ message: 'Email already in use' });

        // Important: do NOT pre-hash here; model pre-save hook hashes automatically
        // Prefer device-provided coordinates. Frontend should send latitude & longitude when available.
        const newUser = new User({ name, email, password, phone, address, latitude: latitude || null, longitude: longitude || null });

        await newUser.save();
        // Issue JWT and set cookie for session management
        const role = newUser.role || 'user';
        const token = jwt.sign({ id: newUser._id, role, email: newUser.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
        const isProd = process.env.NODE_ENV === 'production';
        const cookieOptions = {
            httpOnly: true,
            secure: isProd,
            sameSite: isProd ? 'none' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        };
        if (process.env.COOKIE_DOMAIN) cookieOptions.domain = process.env.COOKIE_DOMAIN;
        res.cookie('token', token, cookieOptions);
        res.status(201).json({ token, user: { id: newUser._id, name: newUser.name, email: newUser.email, role } });
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
        const token = jwt.sign({ id: user._id, role, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
        const isProd = process.env.NODE_ENV === 'production';
        const cookieOptions = {
            httpOnly: true,
            secure: isProd,
            sameSite: isProd ? 'none' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        };
        if (process.env.COOKIE_DOMAIN) cookieOptions.domain = process.env.COOKIE_DOMAIN;
        res.cookie('token', token, cookieOptions);
        res.status(200).json({ token, user: { id: user._id, name: user.name, email: user.email, role } });
    } catch (error) {
        logger.error('Login error: ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Request password reset: generate token, save expiry, email link
exports.requestPasswordReset = async (req, res) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            const signupUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/signup`;
            return res.status(404).json({ message: 'Account not found. Please sign up.', signupUrl });
        }

        // create a secure random token
        const crypto = require('crypto');
        const token = crypto.randomBytes(32).toString('hex');

        // set token and expiry (1 hour)
        user.resetPasswordToken = token;
        user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
        await user.save();

        // Build reset link
        const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

        // send email (best-effort with error handling)
        try {
            await sendPasswordReset(email, { resetUrl, expiresIn: 3600/60 });
        } catch (e) {
            logger.error('sendPasswordReset failed', e);
            // Do not expose email send failures to prevent user enumeration; still return success
        }

        return res.status(200).json({ message: 'If that email exists, a reset link has been sent.' });
    } catch (error) {
        logger.error('Request password reset error: ', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// Reset password using token
exports.resetPassword = async (req, res) => {
    try {
        const { email, token, newPassword } = req.body;
        if (!email || !token || !newPassword) return res.status(400).json({ message: 'Missing required fields' });

        const user = await User.findOne({ email, resetPasswordToken: token, resetPasswordExpires: { $gt: Date.now() } });
        if (!user) return res.status(400).json({ message: 'Invalid or expired token' });

        // update password
        user.password = newPassword; // will be hashed by pre-save hook
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();

        return res.status(200).json({ message: 'Password has been reset successfully' });
    } catch (error) {
        logger.error('Reset password error: ', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

// Logout: clear JWT cookie
exports.logout = (req, res) => {
    const isProd = process.env.NODE_ENV === 'production';
    const cookieOptions = {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
    };
    if (process.env.COOKIE_DOMAIN) cookieOptions.domain = process.env.COOKIE_DOMAIN;
    res.clearCookie('token', cookieOptions);
    return res.status(200).json({ message: 'Logged out' });
};