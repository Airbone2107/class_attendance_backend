const express = require('express');
const router = express.Router();
const { checkIn, validateNfc, validateSession, getStudentClasses, getStudentClassHistory } = require('../controllers/attendanceController');
const { protect } = require('../middleware/authMiddleware');

// Các route dành cho sinh viên
router.post('/check-in', protect, checkIn);
router.post('/validate-session', protect, validateSession); // <-- MỚI: Route chặn ngay bước 1
router.post('/validate-nfc', protect, validateNfc);
router.get('/classes', protect, getStudentClasses);
router.get('/history/:classId', protect, getStudentClassHistory);

module.exports = router;
