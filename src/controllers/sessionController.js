const Session = require('../models/session.model');
const Class = require('../models/class.model');
const Exam = require('../models/exam.model'); // Import mới
const AttendanceRecord = require('../models/attendanceRecord.model');
const { randomBytes } = require('crypto');

// @desc    Tạo phiên điểm danh (Lớp học hoặc Buổi thi)
// @route   POST /api/sessions/create
const createSession = async (req, res) => {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ error: 'Only teachers can create sessions.' });
  }
  
  const { classId, lessonId, examId, level } = req.body;

  try {
    let newSessionData = {
        sessionId: randomBytes(4).toString('hex').toUpperCase(),
        active: true
    };

    // --- TRƯỜNG HỢP 1: ĐIỂM DANH BUỔI THI (Có examId) ---
    if (examId) {
        const exam = await Exam.findOne({ examId });
        if (!exam) return res.status(404).json({ error: 'Không tìm thấy buổi thi.' });

        if (exam.supervisor.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Bạn không phải giám thị buổi thi này.' });
        }

        // Xóa session cũ của exam này
        await Session.deleteMany({ exam: exam._id });

        newSessionData.type = 'exam';
        newSessionData.exam = exam._id;
        // BẮT BUỘC LEVEL 3 CHO BUỔI THI
        newSessionData.level = 3; 
    } 
    // --- TRƯỜNG HỢP 2: ĐIỂM DANH LỚP HỌC (Có classId & lessonId) ---
    else if (classId && lessonId) {
        const classObj = await Class.findOne({ classId });
        if (!classObj) return res.status(404).json({ error: `Class ${classId} not found.` });

        const lessonExists = classObj.lessons.find(l => l.lessonId === lessonId);
        if (!lessonExists) return res.status(404).json({ error: `Lesson ${lessonId} not found.` });

        await Session.deleteMany({ class: classObj._id, lessonId: lessonId });

        newSessionData.type = 'class';
        newSessionData.class = classObj._id;
        newSessionData.lessonId = lessonId;
        newSessionData.level = level || 1;
    } else {
        return res.status(400).json({ error: 'Vui lòng cung cấp classId+lessonId HOẶC examId.' });
    }

    const newSession = new Session(newSessionData);
    await newSession.save();

    res.status(201).json({
      message: newSession.type === 'exam' ? 'Exam session created (Level 3 forced).' : 'Class session created.',
      sessionId: newSession.sessionId,
      level: newSession.level,
      type: newSession.type,
      expiresAt: new Date(newSession.createdAt.getTime() + 5 * 60000)
    });

  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Server error while creating session.' });
  }
};

// ... giữ nguyên getSessionStats ...
// @desc    Lấy thống kê phiên điểm danh (cho màn hình monitor của GV)
// @route   GET /api/sessions/:sessionId/stats
const getSessionStats = async (req, res) => {
    const { sessionId } = req.params;
    try {
        const session = await Session.findOne({ sessionId });
        if (!session) {
            return res.status(404).json({ error: 'Session not found or expired' });
        }

        // Đếm số lượng record điểm danh thuộc session này
        const count = await AttendanceRecord.countDocuments({ session: session._id });
        
        res.status(200).json({
            sessionId,
            count,
            expiresAt: new Date(session.createdAt.getTime() + 5 * 60000)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching stats' });
    }
};

module.exports = { createSession, getSessionStats };