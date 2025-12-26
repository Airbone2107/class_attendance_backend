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

    // 1. Tìm Active Sessions
    const sessions = await Session.find({ class: { $in: classIds } })
        .sort({ createdAt: -1 })
        .lean();

    // 2. Kiểm tra xem buổi học đã có dữ liệu trong AttendanceResult chưa
    // (Aggregate để lấy danh sách các cặp class-lessonId đã có data)
    const resultCounts = await AttendanceResult.aggregate([
        { $match: { class: { $in: classIds } } },
        { $group: { _id: { class: "$class", lessonId: "$lessonId" } } }
    ]);

    const resultAvailableMap = new Set(
        resultCounts.map(r => `${r._id.class.toString()}_${r._id.lessonId}`)
    );

    // 3. Map dữ liệu
    const result = classes.map(cls => {
        const classIdStr = cls._id.toString(); 

        const enrichedLessons = cls.lessons.map(lesson => {
            const lessonIdStr = lesson.lessonId.toString();
            
            // Tìm session active
            const activeSession = sessions.find(s => {
                const sClassStr = s.class ? s.class.toString() : '';
                const sLessonStr = s.lessonId ? s.lessonId.toString() : '';
                return sClassStr === classIdStr && sLessonStr === lessonIdStr;
            });

            // Check xem có data bền vững không
            const hasData = resultAvailableMap.has(`${classIdStr}_${lessonIdStr}`);

            return {
                ...lesson,
                latestSessionId: activeSession ? activeSession.sessionId : null,
                hasData: hasData // Frontend sẽ dùng cờ này để hiện nút "Xem báo cáo"
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

// @desc    Lấy báo cáo chi tiết của một buổi học (Dựa vào AttendanceResult)
// @route   GET /api/classes/:classId/lessons/:lessonId/report
const getLessonReport = async (req, res) => {
    const { classId, lessonId } = req.params;

    try {
        // Tìm Class để lấy danh sách SV gốc
        const classObj = await Class.findOne({ classId }).populate('students', 'userId fullName');
        if (!classObj) return res.status(404).json({ error: 'Lớp học không tồn tại.' });

        // Lấy kết quả từ bảng AttendanceResult (Bền vững)
        const results = await AttendanceResult.find({ 
            class: classObj._id, 
            lessonId: lessonId 
        });

        // Map kết quả
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
            mode: 'history', // Đánh dấu là xem lịch sử
            total: classObj.students.length,
            present: presentCount,
            absent: absentCount,
            missing: 0, // Lịch sử thì không tính missing realtime
            students: report
        });

    } catch (error) {
        console.error('Error fetching lesson report:', error);
        res.status(500).json({ error: 'Lỗi lấy báo cáo.' });
    }
};

module.exports = { getTeacherClasses, getLessonReport };