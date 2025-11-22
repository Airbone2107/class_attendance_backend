// Project001/routes/attendanceRoutes.js
const express = require('express');
const router = express.Router();
const { checkIn } = require('../controllers/attendanceController');
const { protect } = require('../middleware/authMiddleware');

// Chỉ sinh viên (đã đăng nhập) mới có thể điểm danh
router.post('/check-in', protect, checkIn);

module.exports = router;
