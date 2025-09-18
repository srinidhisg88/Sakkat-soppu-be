const express = require('express');
const router = express.Router();
const { listPublicFarmers, getPublicFarmer } = require('../controllers/farmer.controller');

// Public farmer listing and detail
router.get('/', listPublicFarmers);
router.get('/:id', getPublicFarmer);

module.exports = router;
