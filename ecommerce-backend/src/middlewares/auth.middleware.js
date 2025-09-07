const jwt = require('jsonwebtoken');
const logger = require('../config/logger');
const User = require('../models/user.model');

// Lightweight token verifier that sets req.user to the JWT payload (id, role, email)
const authMiddleware = (req, res, next) => {
    const header = req.headers.authorization;
    const token = header && header.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            logger.warn('JWT verify failed', err);
            return res.status(401).json({ message: 'Unauthorized' });
        }
        req.user = decoded;
        next();
    });
};

// Stronger authenticate that loads the full user document (without password)
const authenticate = async (req, res, next) => {
    const header = req.headers.authorization;
    const token = header && header.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Unauthorized' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');
        if (!user) return res.status(401).json({ message: 'Unauthorized' });
        req.user = user;
        next();
    } catch (err) {
        logger.warn('Auth authenticate failed', err);
        return res.status(401).json({ message: 'Unauthorized' });
    }
};

module.exports = authMiddleware;
module.exports.authenticate = authenticate;