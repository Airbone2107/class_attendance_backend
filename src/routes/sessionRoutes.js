const express = require('express');
const router = express.Router();
const { createSession, getSessionStats } = require('../controllers/sessionController');
const { protect } = require('../middleware/authMiddleware');

router.post('/create', protect, createSession);
router.get('/:sessionId/stats', protect, getSessionStats);

module.exports = router;
