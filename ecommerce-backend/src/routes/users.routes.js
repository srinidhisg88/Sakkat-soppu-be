const express = require('express');
const router = express.Router();
const auth = require('../middlewares/auth.middleware');
const { getProfile, updateProfile } = require('../controllers/users.controller');

// Authenticated user profile routes
router.get('/profile', auth.authenticate, getProfile);
router.put('/profile', auth.authenticate, updateProfile);

module.exports = router;
