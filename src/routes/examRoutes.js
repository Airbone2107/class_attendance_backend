const express = require('express');
const router = express.Router();
const { getStudentExams, getTeacherExams } = require('../controllers/examController');
const { protect } = require('../middleware/authMiddleware');

router.get('/student', protect, getStudentExams);
router.get('/teacher', protect, getTeacherExams);

module.exports = router;