const Class = require('../models/class.model');
const Session = require('../models/session.model');

// @desc    Lấy danh sách lớp học của giảng viên (kèm session mới nhất của từng lesson)
// @route   GET /api/classes
const getTeacherClasses = async (req, res) => {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ error: 'Only teachers can view classes.' });
  }

  try {
    // 1. Tìm tất cả các lớp của giảng viên này
    const classes = await Class.find({ teacher: req.user._id }).lean();

    if (!classes || classes.length === 0) {
      return res.status(200).json([]);
    }

    // 2. Lấy danh sách ID của các lớp
    const classIds = classes.map(c => c._id);

    // 3. Tìm tất cả Sessions thuộc các lớp này
    const sessions = await Session.find({ class: { $in: classIds } })
        .sort({ createdAt: -1 }) // Sắp xếp mới nhất lên đầu để lấy phiên gần nhất
        .lean();

    // 4. Map session mới nhất vào từng lesson tương ứng
    const result = classes.map(cls => {
        const enrichedLessons = cls.lessons.map(lesson => {
            // SỬA LỖI: Chuyển đổi về String để so sánh chính xác ObjectId và String
            const latestSession = sessions.find(s => 
                String(s.class) === String(cls._id) && 
                String(s.lessonId) === String(lesson.lessonId)
            );

            return {
                ...lesson,
                latestSessionId: latestSession ? latestSession.sessionId : null
            };
        });

        return { ...cls, lessons: enrichedLessons };
    });

    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching teacher classes:', error);
    res.status(500).json({ error: 'Server error while fetching classes.' });
  }
};

module.exports = { getTeacherClasses };