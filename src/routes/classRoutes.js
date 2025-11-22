// class_attendance_backend/src/routes/classRoutes.js
const express = require('express');
const router = express.Router();
const { getTeacherClasses } = require('../controllers/classController');
const { protect } = require('../middleware/authMiddleware');

// Chỉ giảng viên (đã đăng nhập) mới có thể xem danh sách lớp của mình
router.get('/', protect, getTeacherClasses);

module.exports = router;