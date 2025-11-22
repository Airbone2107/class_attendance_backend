// class_attendance_backend/src/controllers/classController.js
const Class = require('../models/class.model');

// @desc    Lấy danh sách lớp học của giảng viên đang đăng nhập
// @route   GET /api/classes
// @access  Private (Teacher only)
const getTeacherClasses = async (req, res) => {
  // Middleware 'protect' đã xác thực và gán req.user
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ error: 'Only teachers can view classes.' });
  }

  try {
    // Tìm tất cả các lớp học có trường 'teacher' khớp với ID của user đang đăng nhập
    const classes = await Class.find({ teacher: req.user._id })
      .select('classId className -_id'); // Chỉ lấy các trường cần thiết

    if (!classes) {
      return res.status(404).json({ message: 'No classes found for this teacher.' });
    }

    res.status(200).json(classes);
  } catch (error) {
    console.error('Error fetching teacher classes:', error);
    res.status(500).json({ error: 'Server error while fetching classes.' });
  }
};

module.exports = { getTeacherClasses };