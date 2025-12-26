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
        
        // CẬP NHẬT: Lấy danh sách 5 sinh viên mới nhất để hiển thị ticker
        const recentRecords = await AttendanceRecord.find({ session: session._id })
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('student', 'fullName userId');

        const recentCheckins = recentRecords.map(r => ({
            name: r.student.fullName,
            userId: r.student.userId,
            time: r.createdAt
        }));

        res.status(200).json({
            sessionId,
            count,
            recentCheckins, // <-- Dữ liệu mới cho Ticker
            expiresAt: new Date(session.createdAt.getTime() + 5 * 60000), // Mặc định +5p logic cũ (logic thực tế nên lấy expiresAt từ DB nếu có lưu)
            active: session.active
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching stats' });
    }
};

// @desc    Gia hạn thêm thời gian phiên (Reset createdAt thành hiện tại hoặc cộng thêm time)
// @route   POST /api/sessions/:sessionId/extend
const extendSession = async (req, res) => {
    const { sessionId } = req.params;
    try {
        const session = await Session.findOne({ sessionId });
        if (!session) return res.status(404).json({ error: 'Session not found' });

        // Logic đơn giản: Reset createdAt thành hiện tại -> Tự động có thêm 5 phút (theo logic expires mặc định)
        // Hoặc nếu muốn cộng 1 phút chính xác, cần sửa Model để lưu field expiresAt cụ thể.
        // Ở đây ta "refresh" session.
        session.createdAt = new Date(); 
        session.active = true;
        await session.save();

        res.status(200).json({ 
            message: 'Session extended', 
            expiresAt: new Date(session.createdAt.getTime() + 5 * 60000) 
        });
    } catch (error) {
        res.status(500).json({ error: 'Error extending session' });
    }
};

// @desc    Kết thúc phiên sớm
// @route   POST /api/sessions/:sessionId/end
const endSession = async (req, res) => {
    const { sessionId } = req.params;
    try {
        const session = await Session.findOne({ sessionId });
        if (!session) return res.status(404).json({ error: 'Session not found' });

        session.active = false;
        // Đặt thời gian tạo về quá khứ xa để logic hết hạn tự kích hoạt
        session.createdAt = new Date(Date.now() - 60 * 60000); 
        await session.save();

        res.status(200).json({ message: 'Session ended successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Error ending session' });
    }
};

// @desc    Lấy báo cáo tổng kết sau phiên
// @route   GET /api/sessions/:sessionId/report
const getSessionReport = async (req, res) => {
    const { sessionId } = req.params;
    try {
        const session = await Session.findOne({ sessionId })
            .populate({
                path: 'class',
                populate: { path: 'students', select: 'userId fullName' }
            })
            .populate({
                path: 'exam',
                populate: { path: 'students', select: 'userId fullName' }
            });

        if (!session) return res.status(404).json({ error: 'Session not found' });

        // Lấy danh sách tất cả sinh viên được phép (từ Class hoặc Exam)
        let allStudents = [];
        if (session.type === 'class' && session.class) {
            allStudents = session.class.students;
        } else if (session.type === 'exam' && session.exam) {
            allStudents = session.exam.students;
        }

        // Lấy danh sách đã điểm danh
        const records = await AttendanceRecord.find({ session: session._id });
        const presentStudentIds = records.map(r => r.student.toString());

        // Map kết quả
        const report = allStudents.map(student => {
            const isPresent = presentStudentIds.includes(student._id.toString());
            return {
                userId: student.userId,
                fullName: student.fullName,
                status: isPresent ? 'present' : 'absent',
                checkInTime: isPresent ? records.find(r => r.student.toString() === student._id.toString()).createdAt : null
            };
        });

        const total = allStudents.length;
        const presentCount = records.length;

        res.status(200).json({
            sessionId,
            total,
            present: presentCount,
            absent: total - presentCount,
            students: report
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error generating report' });
    }
};

module.exports = { 
    createSession, 
    getSessionStats, 
    extendSession, 
    endSession,
    getSessionReport 
};