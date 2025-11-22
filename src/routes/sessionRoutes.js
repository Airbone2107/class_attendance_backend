// Project001/routes/sessionRoutes.js
const express = require('express');
const router = express.Router();
const { createSession } = require('../controllers/sessionController');
const { protect } = require('../middleware/authMiddleware');

// Chỉ giảng viên (đã đăng nhập) mới có thể tạo session
router.post('/create', protect, createSession);

module.exports = router;
