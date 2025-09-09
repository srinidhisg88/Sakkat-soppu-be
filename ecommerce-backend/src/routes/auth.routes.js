const express = require('express');
const { signup, login, requestPasswordReset, resetPassword, logout, adminSignup, adminLogin } = require('../controllers/auth.controller');
const { validateSignup, validateLogin, validateForgotPassword, validateResetPassword, validateAdminSignup, validateAdminLogin } = require('../utils/validators');

const router = express.Router();

router.post('/signup', validateSignup, signup);
router.post('/login', validateLogin, login);
router.post('/logout', logout);
// Admin auth endpoints
router.post('/admin/signup', validateAdminSignup, adminSignup);
router.post('/admin/login', validateAdminLogin, adminLogin);
// Password reset endpoints
router.post('/forgot-password', validateForgotPassword, requestPasswordReset);
router.post('/reset-password', validateResetPassword, resetPassword);

module.exports = router;