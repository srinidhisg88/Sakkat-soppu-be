const express = require('express');
const router = express.Router();
const { stockStream, stockHealth } = require('../controllers/realtime.controller');

router.get('/stock/health', stockHealth);
router.get('/stock', stockStream);

module.exports = router;
