const express = require('express');
const { signup, login, requestPasswordReset, resetPassword, logout } = require('../controllers/auth.controller');
const { validateSignup, validateLogin, validateForgotPassword, validateResetPassword } = require('../utils/validators');

const router = express.Router();

router.post('/signup', validateSignup, signup);
router.post('/login', validateLogin, login);
router.post('/logout', logout);
// Password reset endpoints
router.post('/forgot-password', validateForgotPassword, requestPasswordReset);
router.post('/reset-password', validateResetPassword, resetPassword);

module.exports = router;