const Session = require('../models/session.model');
const Class = require('../models/class.model');
const Exam = require('../models/exam.model');
const AttendanceRecord = require('../models/attendanceRecord.model');
const { randomBytes } = require('crypto');

// @desc    Tạo phiên điểm danh
// @route   POST /api/sessions/create
const createSession = async (req, res) => {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ error: 'Only teachers can create sessions.' });
  }
  
  // MỚI: Nhận thêm field mode
  const { classId, lessonId, examId, level, mode } = req.body;

  try {
    let newSessionData = {
        sessionId: randomBytes(4).toString('hex').toUpperCase(),
        active: true,
        mode: mode || 'standard' // Mặc định là standard
    };

    if (examId) {
        const exam = await Exam.findOne({ examId });
        if (!exam) return res.status(404).json({ error: 'Không tìm thấy buổi thi.' });
        if (exam.supervisor.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Bạn không phải giám thị buổi thi này.' });
        }

        await Session.deleteMany({ exam: exam._id });
        newSessionData.type = 'exam';
        newSessionData.exam = exam._id;
        newSessionData.level = 3; 
    } else if (classId && lessonId) {
        const classObj = await Class.findOne({ classId });
        if (!classObj) return res.status(404).json({ error: `Class ${classId} not found.` });
        
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
      message: 'Session created.',
      sessionId: newSession.sessionId,
      level: newSession.level,
      type: newSession.type,
      mode: newSession.mode, // Trả về mode để Client biết
      expiresAt: new Date(newSession.createdAt.getTime() + 5 * 60000)
    });

  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Server error while creating session.' });
  }
};

// @desc    Lấy thống kê phiên điểm danh
// @route   GET /api/sessions/:sessionId/stats
const getSessionStats = async (req, res) => {
    const { sessionId } = req.params;
    try {
        const session = await Session.findOne({ sessionId });
        if (!session) return res.status(404).json({ error: 'Session not found' });

        // Đếm record trỏ tới session hiện tại (đã tham gia phiên này)
        const count = await AttendanceRecord.countDocuments({ session: session._id });
        
        const recentRecords = await AttendanceRecord.find({ session: session._id })
            .sort({ updatedAt: -1 }) // Lấy record mới được update
            .limit(5)
            .populate('student', 'fullName userId');

        const recentCheckins = recentRecords.map(r => ({
            name: r.student.fullName,
            userId: r.student.userId,
            // Dùng updatedAt để hiển thị thời gian vừa quét (kể cả khi checkInTime giữ nguyên)
            time: r.updatedAt 
        }));

        res.status(200).json({
            sessionId,
            count,
            recentCheckins,
            expiresAt: new Date(session.createdAt.getTime() + 5 * 60000), 
            active: session.active,
            mode: session.mode
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching stats' });
    }
};

// @desc    Gia hạn thêm thời gian phiên
const extendSession = async (req, res) => {
    const { sessionId } = req.params;
    try {
        const session = await Session.findOne({ sessionId });
        if (!session) return res.status(404).json({ error: 'Session not found' });
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
const endSession = async (req, res) => {
    const { sessionId } = req.params;
    try {
        const session = await Session.findOne({ sessionId });
        if (!session) return res.status(404).json({ error: 'Session not found' });
        session.active = false;
        session.createdAt = new Date(Date.now() - 60 * 60000); 
        await session.save();
        res.status(200).json({ message: 'Session ended successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Error ending session' });
    }
};

// @desc    Lấy báo cáo tổng kết
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

        let allStudents = [];
        let query = {};

        if (session.type === 'class' && session.class) {
            allStudents = session.class.students;
            query = { class: session.class._id, lessonId: session.lessonId };
        } else if (session.type === 'exam' && session.exam) {
            allStudents = session.exam.students;
            query = { exam: session.exam._id };
        }

        // Lấy TẤT CẢ record của buổi học này (bất kể session nào)
        const allRecords = await AttendanceRecord.find(query);

        // Map kết quả
        const report = allStudents.map(student => {
            const record = allRecords.find(r => r.student.toString() === student._id.toString());
            
            let status = 'absent';
            let checkInTime = null;

            if (record) {
                if (session.mode === 'reinforced') {
                    // Logic Tăng cường:
                    // - Có record VÀ session khớp với session tăng cường => CÓ MẶT (Đã scan cả 2 lần)
                    // - Có record NHƯNG session KHÁC session tăng cường => THIẾU (Có lần 1, vắng lần 2)
                    if (record.session && record.session.toString() === session._id.toString()) {
                        status = 'present';
                        checkInTime = record.checkInTime; // Giờ gốc
                    } else {
                        status = 'missing'; // Trạng thái mới: Thiếu
                        checkInTime = record.checkInTime; // Vẫn hiện giờ đến lần đầu
                    }
                } else {
                    // Logic Standard: Chỉ cần có record là Có mặt
                    status = 'present';
                    checkInTime = record.checkInTime;
                }
            }

            return {
                userId: student.userId,
                fullName: student.fullName,
                status: status, // present, missing, absent
                checkInTime: checkInTime
            };
        });

        const total = allStudents.length;
        const presentCount = report.filter(r => r.status === 'present').length;
        const missingCount = report.filter(r => r.status === 'missing').length; // Chỉ dùng cho reinforced
        const absentCount = report.filter(r => r.status === 'absent').length;

        res.status(200).json({
            sessionId,
            mode: session.mode,
            total,
            present: presentCount,
            missing: missingCount,
            absent: absentCount,
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
