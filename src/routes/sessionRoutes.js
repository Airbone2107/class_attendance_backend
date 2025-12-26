const express = require('express');
const router = express.Router();
const { 
    createSession, 
    getSessionStats, 
    extendSession, 
    endSession,
    getSessionReport 
} = require('../controllers/sessionController');
const { protect } = require('../middleware/authMiddleware');

router.post('/create', protect, createSession);
router.get('/:sessionId/stats', protect, getSessionStats);

// Các route mới cho chức năng kiểm soát phiên
router.post('/:sessionId/extend', protect, extendSession);
router.post('/:sessionId/end', protect, endSession);
router.get('/:sessionId/report', protect, getSessionReport);

module.exports = router;
