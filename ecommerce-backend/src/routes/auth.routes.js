const express = require('express');
const { signup, login, requestPasswordReset, resetPassword, logout, adminSignup, adminLogin, googleLogin } = require('../controllers/auth.controller');
const { validateSignup, validateLogin, validateForgotPassword, validateResetPassword, validateAdminSignup, validateAdminLogin } = require('../utils/validators');

const router = express.Router();

router.post('/signup', validateSignup, signup);
router.post('/login', validateLogin, login);
// Google OAuth: send Google ID token; returns our JWT cookie
router.post('/google', googleLogin);
router.post('/logout', logout);
// Admin auth endpoints
router.post('/admin/signup', validateAdminSignup, adminSignup);
router.post('/admin/login', validateAdminLogin, adminLogin);
// Password reset endpoints
router.post('/forgot-password', validateForgotPassword, requestPasswordReset);
router.post('/reset-password', validateResetPassword, resetPassword);

module.exports = router;