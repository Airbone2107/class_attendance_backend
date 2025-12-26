// class_attendance_backend/src/routes/classRoutes.js
const express = require('express');
const router = express.Router();
const { getTeacherClasses, getLessonReport } = require('../controllers/classController'); // Import thêm getLessonReport
const { protect } = require('../middleware/authMiddleware');

// Chỉ giảng viên (đã đăng nhập) mới có thể xem danh sách lớp của mình
router.get('/', protect, getTeacherClasses);

// Route mới: Lấy báo cáo dựa trên ClassId và LessonId (Bền vững)
router.get('/:classId/lessons/:lessonId/report', protect, getLessonReport);

module.exports = router;