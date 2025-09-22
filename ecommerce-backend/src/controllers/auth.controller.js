const User = require('../models/user.model');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { sendEmail, sendPasswordReset } = require('../services/email.service');
// Previously used getGeocode; now prefer device-provided lat/lng
const logger = require('../config/logger');
const { OAuth2Client } = require('google-auth-library');

const googleClient = (() => {
  try {
    if (process.env.GOOGLE_CLIENT_ID) {
      return new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    }
  } catch (e) {
    logger.error('Failed to initialize Google OAuth client', e);
  }
  return null;
})();

// User signup
exports.signup = async (req, res) => {
    try {
        const { name, email, password, phone, address: area, latitude, longitude } = req.body;

        const existing = await User.findOne({ email });
        if (existing) return res.status(409).json({ message: 'Email already in use' });

        // Build address object from area string
        const address = {
            houseNo: '',
            landmark: '',
            area: area || '',
            city: 'Mysore',
            state: 'Karnataka',
            pincode: '',
        };

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

// Google OAuth login/signup using ID token
exports.googleLogin = async (req, res) => {
    try {
        const { idToken, latitude, longitude } = req.body;
        if (!process.env.GOOGLE_CLIENT_ID) {
            return res.status(500).json({ message: 'Google login not configured' });
        }
        if (!idToken) return res.status(400).json({ message: 'Missing idToken' });

        // Verify token with Google
        const ticket = await googleClient.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const googleId = payload.sub;
        const email = payload.email?.toLowerCase();
        const emailVerified = !!payload.email_verified;
        const name = payload.name || email?.split('@')[0] || 'User';
        const picture = payload.picture || undefined;

        if (!email) return res.status(400).json({ message: 'Email not present in Google token' });

        // Find existing user either by googleId or email
        let user = await User.findOne({ $or: [{ googleId }, { email }] });
        const isNew = !user;

        if (!user) {
            // Create a user with a random password (won't be used for Google accounts)
            const crypto = require('crypto');
            const randomPassword = crypto.randomBytes(16).toString('hex');
            user = new User({
                name,
                email,
                password: randomPassword,
                provider: 'google',
                googleId,
                emailVerified,
                picture,
                latitude: latitude || null,
                longitude: longitude || null,
            });
            await user.save();
        } else {
            // Update linkage if needed
            let updated = false;
            if (!user.googleId) { user.googleId = googleId; updated = true; }
            if (picture && user.picture !== picture) { user.picture = picture; updated = true; }
            if (emailVerified && !user.emailVerified) { user.emailVerified = true; updated = true; }
            if (latitude != null && user.latitude == null) { user.latitude = latitude; updated = true; }
            if (longitude != null && user.longitude == null) { user.longitude = longitude; updated = true; }
            if (user.provider !== 'google') { user.provider = 'google'; updated = true; }
            if (updated) await user.save();
        }

        const role = user.role || 'user';
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
        return res.status(200).json({ token, user: { id: user._id, name: user.name, email: user.email, role, isNew } });
    } catch (error) {
        logger.error('Google login error: ', error);
        return res.status(401).json({ message: 'Invalid Google token' });
    }
};

// User login
exports.login = async (req, res) => {
     try {
         const { email, password } = req.body;
         // Find user by email
         const user = await User.findOne({ email });

         if (!user) return res.status(401).json({ message: 'Invalid credentials' });

         const isMatch = await bcrypt.compare(password, user.password);
         if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

         const role = user.role;
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

// Admin signup - protected by ADMIN_SIGNUP_CODE
exports.adminSignup = async (req, res) => {
    try {
        const { name, email, password, phone, address, latitude, longitude, adminCode } = req.body;
        if (!process.env.ADMIN_SIGNUP_CODE) {
            return res.status(500).json({ message: 'Admin signup disabled. Missing ADMIN_SIGNUP_CODE.' });
        }
        if (adminCode !== process.env.ADMIN_SIGNUP_CODE) {
            return res.status(403).json({ message: 'Invalid admin signup code' });
        }

        const existing = await User.findOne({ email });
        if (existing) return res.status(409).json({ message: 'Email already in use' });

        const newAdmin = new User({
            name,
            email,
            password,
            phone,
            address,
            latitude: latitude || null,
            longitude: longitude || null,
            role: 'admin',
        });

        await newAdmin.save();
        const role = 'admin';
        const token = jwt.sign({ id: newAdmin._id, role, email: newAdmin.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
        const isProd = process.env.NODE_ENV === 'production';
        const cookieOptions = {
            httpOnly: true,
            secure: isProd,
            sameSite: isProd ? 'none' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        };
        if (process.env.COOKIE_DOMAIN) cookieOptions.domain = process.env.COOKIE_DOMAIN;
        res.cookie('token', token, cookieOptions);
        res.status(201).json({ token, user: { id: newAdmin._id, name: newAdmin.name, email: newAdmin.email, role } });
    } catch (error) {
        logger.error('Admin signup error: ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Admin login - only allow users with role admin
exports.adminLogin = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user || user.role !== 'admin') {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: 'Invalid credentials' });

        const role = 'admin';
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
        logger.error('Admin login error: ', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};