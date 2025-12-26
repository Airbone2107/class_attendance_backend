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

    // --- DEBUG LOGS (Xem trong Terminal Server) ---
    console.log(`[DEBUG] Teacher: ${req.user.userId}`);
    console.log(`[DEBUG] Total Classes found: ${classes.length}`);
    console.log(`[DEBUG] Total Sessions found in DB for these classes: ${sessions.length}`);
    if (sessions.length > 0) {
        console.log('[DEBUG] Sample Session Data:', {
            id: sessions[0]._id,
            class: sessions[0].class, // Mong đợi là ObjectId
            lessonId: sessions[0].lessonId,
            sessionId: sessions[0].sessionId
        });
    }
    // ----------------------------------------------

    // 4. Map session mới nhất vào từng lesson tương ứng
    const result = classes.map(cls => {
        // Chuyển đổi ID lớp hiện tại sang String chuẩn để so sánh
        const classIdStr = cls._id.toString(); 

        const enrichedLessons = cls.lessons.map(lesson => {
            const lessonIdStr = lesson.lessonId.toString();

            // Tìm session khớp classId và lessonId trong danh sách sessions đã lấy
            const latestSession = sessions.find(s => {
                // Kiểm tra an toàn và convert sang string
                const sClassStr = s.class ? s.class.toString() : '';
                const sLessonStr = s.lessonId ? s.lessonId.toString() : '';
                
                return sClassStr === classIdStr && sLessonStr === lessonIdStr;
            });

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