const express = require('express');
const router = express.Router();
const { checkIn, getStudentClasses, getStudentClassHistory } = require('../controllers/attendanceController');
const { protect } = require('../middleware/authMiddleware');

// Các route dành cho sinh viên
router.post('/check-in', protect, checkIn);
router.get('/classes', protect, getStudentClasses);
router.get('/history/:classId', protect, getStudentClassHistory);

module.exports = router;
