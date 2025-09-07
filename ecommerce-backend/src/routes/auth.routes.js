const express = require('express');
const { signup, login } = require('../controllers/auth.controller');
const { validateSignup, validateLogin } = require('../utils/validators');

const router = express.Router();

router.post('/signup', validateSignup, signup);
router.post('/login', validateLogin, login);

module.exports = router;