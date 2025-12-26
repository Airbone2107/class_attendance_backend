const Session = require('../models/session.model');
const Class = require('../models/class.model');
const Exam = require('../models/exam.model');
const AttendanceRecord = require('../models/attendanceRecord.model');
const AttendanceResult = require('../models/attendanceResult.model'); // Import mới
const { randomBytes } = require('crypto');

// ... (Giữ nguyên createSession, getSessionStats, extendSession, endSession) ...
const createSession = async (req, res) => {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ error: 'Only teachers can create sessions.' });
  }
  
  const { classId, lessonId, examId, level, mode } = req.body;

  try {
    let newSessionData = {
        sessionId: randomBytes(4).toString('hex').toUpperCase(),
        active: true,
        mode: mode || 'standard' 
    };

    if (examId) {
        const exam = await Exam.findOne({ examId });
        if (!exam) return res.status(404).json({ error: 'Không tìm thấy buổi thi.' });
        if (exam.supervisor.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Bạn không phải giám thị buổi thi này.' });
        }

        // Với DB mới, không cần deleteMany Session cũ, vì log được lưu riêng
        // Nhưng logic nghiệp vụ có thể vẫn muốn chỉ 1 session active tại 1 thời điểm
        await Session.updateMany({ exam: exam._id, active: true }, { active: false });
        
        newSessionData.type = 'exam';
        newSessionData.exam = exam._id;
        newSessionData.level = 3; 
    } else if (classId && lessonId) {
        const classObj = await Class.findOne({ classId });
        if (!classObj) return res.status(404).json({ error: `Class ${classId} not found.` });
        
        await Session.updateMany({ class: classObj._id, lessonId: lessonId, active: true }, { active: false });

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
      mode: newSession.mode, 
      expiresAt: new Date(newSession.createdAt.getTime() + 5 * 60000)
    });

  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Server error while creating session.' });
  }
};

const getSessionStats = async (req, res) => {
    const { sessionId } = req.params;
    try {
        const session = await Session.findOne({ sessionId });
        if (!session) return res.status(404).json({ error: 'Session not found' });

        // Đếm record trong bảng LOG (AttendanceRecord) trỏ tới session hiện tại
        const count = await AttendanceRecord.countDocuments({ session: session._id });
        
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

// CẬP NHẬT: Logic báo cáo sử dụng cả 2 bảng
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
        let resultQuery = {};
        let logQuery = { session: session._id }; // Query log chỉ của session này

        if (session.type === 'class' && session.class) {
            allStudents = session.class.students;
            resultQuery = { class: session.class._id, lessonId: session.lessonId };
        } else if (session.type === 'exam' && session.exam) {
            allStudents = session.exam.students;
            resultQuery = { exam: session.exam._id };
        }

        // 1. Lấy kết quả tổng hợp (Ai đã từng có mặt trong buổi này)
        const allResults = await AttendanceResult.find(resultQuery);
        
        // 2. Lấy log của session hiện tại (Ai quét trong session này)
        const currentSessionLogs = await AttendanceRecord.find(logQuery);

        // Map kết quả
        const report = allStudents.map(student => {
            const result = allResults.find(r => r.student.toString() === student._id.toString());
            const sessionLog = currentSessionLogs.find(r => r.student.toString() === student._id.toString());
            
            let status = 'absent';
            let checkInTime = null;

            if (session.mode === 'reinforced') {
                // Logic Tăng cường:
                if (result) { // Đã có mặt từ trước
                    if (sessionLog) {
                        status = 'present'; // Có mặt lần trước VÀ lần này
                        checkInTime = sessionLog.checkInTime;
                    } else {
                        status = 'missing'; // Có mặt lần trước NHƯNG vắng lần này
                        checkInTime = result.firstCheckIn; // Lấy giờ cũ
                    }
                } else {
                    status = 'absent'; // Vắng từ đầu
                }
            } else {
                // Logic Standard: Chỉ cần có kết quả trong AttendanceResult là Có mặt
                if (result) {
                    status = 'present';
                    checkInTime = result.firstCheckIn; // Lấy giờ checkin đầu tiên
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
        const missingCount = report.filter(r => r.status === 'missing').length; 
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