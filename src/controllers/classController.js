const Class = require('../models/class.model');

// @desc    Lấy danh sách lớp học của giảng viên (kèm danh sách buổi học)
// @route   GET /api/classes
const getTeacherClasses = async (req, res) => {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ error: 'Only teachers can view classes.' });
  }

  try {
    // Tìm tất cả các lớp của giảng viên này
    const classes = await Class.find({ teacher: req.user._id });

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