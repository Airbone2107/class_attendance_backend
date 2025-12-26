const Class = require('../models/class.model');
const Session = require('../models/session.model');
const AttendanceResult = require('../models/attendanceResult.model');

// @desc    Lấy danh sách lớp học của giảng viên
// @route   GET /api/classes
const getTeacherClasses = async (req, res) => {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ error: 'Only teachers can view classes.' });
  }

  try {
    const classes = await Class.find({ teacher: req.user._id }).lean();
    if (!classes || classes.length === 0) return res.status(200).json([]);

    const classIds = classes.map(c => c._id);

    // 1. Tìm Active Sessions (Session CHƯA hết hạn VÀ active=true)
    const activeSessions = await Session.find({ 
        class: { $in: classIds },
        active: true // BẮT BUỘC
    }).lean();

    // 2. Kiểm tra lịch sử
    const resultCounts = await AttendanceResult.aggregate([
        { $match: { class: { $in: classIds } } },
        { $group: { _id: { class: "$class", lessonId: "$lessonId" } } }
    ]);

    const resultAvailableMap = new Set(
        resultCounts.map(r => `${r._id.class.toString()}_${r._id.lessonId}`)
    );

    const result = classes.map(cls => {
        const classIdStr = cls._id.toString(); 

        const enrichedLessons = cls.lessons.map(lesson => {
            const lessonIdStr = lesson.lessonId.toString();
            
            // Tìm session ĐANG HOẠT ĐỘNG
            const activeSession = activeSessions.find(s => {
                const sClassStr = s.class ? s.class.toString() : '';
                const sLessonStr = s.lessonId ? s.lessonId.toString() : '';
                return sClassStr === classIdStr && sLessonStr === lessonIdStr;
            });

            // Nếu có session active -> Trả về ID thật -> Frontend hiện nút "Tiếp tục" / "Đang mở"
            // Nếu không -> Trả về null -> Frontend hiện nút "Điểm danh thêm" (hoặc "Bắt đầu")
            
            const hasData = resultAvailableMap.has(`${classIdStr}_${lessonIdStr}`);
            
            // Logic tạo ID ảo để xem report nếu session đã chết
            let latestSessionId = null;
            if (activeSession) {
                latestSessionId = activeSession.sessionId;
            } else if (hasData) {
                latestSessionId = `HISTORY-CLASS-${classIdStr}-${lessonIdStr}`;
            }

            return {
                ...lesson,
                latestSessionId: latestSessionId,
                activeSessionId: activeSession ? activeSession.sessionId : null, // Trường mới để phân biệt rõ
                hasData: hasData
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

// ... (getLessonReport giữ nguyên) ...
const getLessonReport = async (req, res) => {
    // ... Copy code cũ của getLessonReport vào đây
    const { classId, lessonId } = req.params;

    try {
        const classObj = await Class.findOne({ classId }).populate('students', 'userId fullName');
        if (!classObj) return res.status(404).json({ error: 'Lớp học không tồn tại.' });

        const results = await AttendanceResult.find({ 
            class: classObj._id, 
            lessonId: lessonId 
        });

        const report = classObj.students.map(student => {
            const record = results.find(r => r.student.toString() === student._id.toString());
            
            return {
                userId: student.userId,
                fullName: student.fullName,
                status: record ? record.status : 'absent',
                checkInTime: record ? record.firstCheckIn : null,
                checkInCount: record ? record.checkInCount : 0
            };
        });

        const presentCount = report.filter(r => r.status === 'present').length;
        const absentCount = report.filter(r => r.status === 'absent').length;

        res.status(200).json({
            classId,
            lessonId,
            mode: 'history', 
            total: classObj.students.length,
            present: presentCount,
            absent: absentCount,
            missing: 0, 
            students: report
        });

    } catch (error) {
        console.error('Error fetching lesson report:', error);
        res.status(500).json({ error: 'Lỗi lấy báo cáo.' });
    }
};

module.exports = { getTeacherClasses, getLessonReport };