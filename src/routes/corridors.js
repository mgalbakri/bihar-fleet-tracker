// Corridor routes -- corridor status and management
const express = require('express');
const corridorStatus = require('../services/risk/corridor-status');
const router = express.Router();

// GET /api/corridors -- get all corridor statuses
router.get('/', (req, res) => {
  res.json(corridorStatus.getAll());
});

module.exports = router;
