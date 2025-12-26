const Session = require('../models/session.model');
const Class = require('../models/class.model');
const Exam = require('../models/exam.model');
const AttendanceRecord = require('../models/attendanceRecord.model');
const AttendanceResult = require('../models/attendanceResult.model'); 
const { randomBytes } = require('crypto');

// @desc    Tạo phiên điểm danh
// @route   POST /api/sessions/create
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

// @desc    Lấy thống kê phiên điểm danh
// @route   GET /api/sessions/:sessionId/stats
const getSessionStats = async (req, res) => {
    const { sessionId } = req.params;
    try {
        const session = await Session.findOne({ sessionId });
        if (!session) return res.status(404).json({ error: 'Session not found' });

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
// @note    Đây là nơi xử lý logic chốt sổ "Vắng tăng cường"
const endSession = async (req, res) => {
    const { sessionId } = req.params;
    try {
        const session = await Session.findOne({ sessionId });
        if (!session) return res.status(404).json({ error: 'Session not found' });
        
        // 1. Đóng session ngay lập tức
        session.active = false;
        session.createdAt = new Date(Date.now() - 60 * 60000); // Expire
        await session.save();

        // 2. LOGIC QUAN TRỌNG: Cập nhật DB thành ABSENT (Vắng) nếu mode là reinforced
        if (session.mode === 'reinforced') {
            let filterResult = {};
            if (session.class) {
                filterResult = { class: session.class, lessonId: session.lessonId };
            } else if (session.exam) {
                filterResult = { exam: session.exam };
            }

            // Lấy tất cả SV đã từng check-in (có trong Result)
            const existingResults = await AttendanceResult.find(filterResult);

            // Lấy danh sách SV đã check-in trong phiên này (Log)
            const currentSessionLogs = await AttendanceRecord.find({ session: session._id });
            const scannedStudentIds = new Set(currentSessionLogs.map(r => r.student.toString()));

            // Tìm những người có Result nhưng KHÔNG có Log phiên này
            const dropOutStudentIds = existingResults
                .filter(r => !scannedStudentIds.has(r.student.toString()))
                .map(r => r.student);

            if (dropOutStudentIds.length > 0) {
                console.log(`[Reinforced Logic] Setting ${dropOutStudentIds.length} students to ABSENT permanently.`);
                
                // Cập nhật trạng thái thành Vắng (absent) vĩnh viễn trong DB
                await AttendanceResult.updateMany(
                    { 
                        ...filterResult,
                        student: { $in: dropOutStudentIds }
                    },
                    { 
                        $set: { status: 'absent' } 
                    }
                );
            }
        }

        res.status(200).json({ message: 'Session ended successfully' });
    } catch (error) {
        console.error("End session error:", error);
        res.status(500).json({ error: 'Error ending session' });
    }
};

// @desc    Lấy báo cáo tổng kết
// @route   GET /api/sessions/:sessionId/report
const getSessionReport = async (req, res) => {
    const { sessionId } = req.params;
    try {
        let session = await Session.findOne({ sessionId })
            .populate({
                path: 'class',
                populate: { path: 'students', select: 'userId fullName' }
            })
            .populate({
                path: 'exam',
                populate: { path: 'students', select: 'userId fullName' }
            });

        // Xử lý ID ảo (History)
        if (!session) {
            if (sessionId.startsWith('HISTORY-')) {
                const parts = sessionId.split('-'); 
                const type = parts[1];
                const dbId = parts[2];
                
                if (type === 'CLASS') {
                    const lessonId = parts[3];
                    const classObj = await Class.findById(dbId).populate('students', 'userId fullName');
                    if (classObj) {
                        session = {
                            _id: null,
                            sessionId: sessionId,
                            type: 'class',
                            class: classObj,
                            lessonId: lessonId,
                            mode: 'standard',
                            active: false
                        };
                    }
                } else if (type === 'EXAM') {
                    const examObj = await Exam.findById(dbId).populate('students', 'userId fullName');
                    if (examObj) {
                        session = {
                            _id: null,
                            sessionId: sessionId,
                            type: 'exam',
                            exam: examObj,
                            mode: 'standard',
                            active: false
                        };
                    }
                }
            }
        }

        if (!session) return res.status(404).json({ error: 'Session/Data not found' });

        let allStudents = [];
        let resultQuery = {};
        // Chỉ tìm Record Log nếu session là thật (có _id)
        let logQuery = session._id ? { session: session._id } : null;

        if (session.type === 'class' && session.class) {
            allStudents = session.class.students;
            resultQuery = { class: session.class._id, lessonId: session.lessonId };
        } else if (session.type === 'exam' && session.exam) {
            allStudents = session.exam.students;
            resultQuery = { exam: session.exam._id };
        }

        const allResults = await AttendanceResult.find(resultQuery);
        const currentSessionLogs = logQuery ? await AttendanceRecord.find(logQuery) : [];

        const report = allStudents.map(student => {
            const result = allResults.find(r => r.student.toString() === student._id.toString());
            const sessionLog = currentSessionLogs.find(r => r.student.toString() === student._id.toString());
            
            let status = 'absent';
            let checkInTime = null;

            if (session.mode === 'reinforced') {
                // Logic hiển thị cho Tăng cường
                if (result) {
                    // Nếu có Log quét lần này -> Có mặt
                    if (sessionLog) {
                        status = 'present';
                        checkInTime = sessionLog.checkInTime;
                    } else {
                        // Nếu có Result (đã đi học trước đó) nhưng KHÔNG có Log lần này -> Thiếu (Missing)
                        // Bất kể trong DB Result đang là 'present' hay đã bị update thành 'absent'
                        // Ở màn hình này, chúng ta muốn nhấn mạnh việc họ bị "Rớt" ở phiên này
                        status = 'missing'; 
                        checkInTime = result.firstCheckIn; // Hiển thị giờ vào lần đầu để đối chiếu
                    }
                } else {
                    status = 'absent'; // Vắng từ đầu
                }
            } else {
                // Standard: Chỉ cần có kết quả là Present (kể cả xem lại lịch sử)
                if (result) {
                    status = result.status; 
                    checkInTime = result.firstCheckIn;
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