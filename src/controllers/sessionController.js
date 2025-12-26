const Session = require('../models/session.model');
const Class = require('../models/class.model');
const Exam = require('../models/exam.model');
const AttendanceRecord = require('../models/attendanceRecord.model');
const AttendanceResult = require('../models/attendanceResult.model'); 
const { randomBytes } = require('crypto');

// ... (Giữ nguyên createSession, getSessionStats, extendSession) ...
// Copy lại 3 hàm trên từ code cũ, không thay đổi gì. 
// Chỉ thay đổi hàm endSession và getSessionReport bên dưới.

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

// --- LOGIC KẾT THÚC PHIÊN ĐIỂM DANH ---
const endSession = async (req, res) => {
    const { sessionId } = req.params;
    try {
        const session = await Session.findOne({ sessionId });
        if (!session) return res.status(404).json({ error: 'Session not found' });
        
        // 1. Đóng session
        session.active = false;
        // Đặt thời gian hết hạn về quá khứ để expire sau 5 phút tính từ bây giờ (hoặc expire ngay lập tức tùy config DB)
        // Ở đây ta giữ record session thêm 1 lúc nhưng set active=false
        session.createdAt = new Date(Date.now() - 60 * 60000); 
        await session.save();

        // 2. Xử lý Logic Tăng cường (Reinforced)
        // Nếu là phiên tăng cường => Những ai có trong Result (đã đi học) mà KHÔNG có trong Log của phiên này => Cập nhật thành ABSENT
        if (session.mode === 'reinforced') {
            let filterResult = {};
            if (session.class) {
                filterResult = { class: session.class, lessonId: session.lessonId };
            } else if (session.exam) {
                filterResult = { exam: session.exam };
            }

            // Lấy danh sách những người đã được ghi nhận là "Có mặt" trước đó
            const previousPresents = await AttendanceResult.find({ 
                ...filterResult, 
                status: 'present' 
            });

            // Lấy danh sách những người đã quét trong phiên tăng cường này
            const currentSessionLogs = await AttendanceRecord.find({ session: session._id });
            const scannedStudentIds = new Set(currentSessionLogs.map(r => r.student.toString()));

            // Tìm những người "rụng" (Có trước đó nhưng không quét lại)
            const dropOutStudentIds = previousPresents
                .filter(r => !scannedStudentIds.has(r.student.toString()))
                .map(r => r.student);

            if (dropOutStudentIds.length > 0) {
                console.log(`[Reinforced Logic] Marking ${dropOutStudentIds.length} students as ABSENT.`);
                
                // Cập nhật trạng thái thành Vắng (absent)
                await AttendanceResult.updateMany(
                    { 
                        ...filterResult,
                        student: { $in: dropOutStudentIds }
                    },
                    { 
                        $set: { status: 'absent' } // Quy định: Vắng tăng cường = Vắng luôn
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

const getSessionReport = async (req, res) => {
    // ... (Giữ nguyên logic getSessionReport đã update ở bước trước) ...
    // Copy lại nội dung hàm getSessionReport từ response trước
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

            // Nếu đang xem report của session Tăng Cường (Vừa kết thúc hoặc đang chạy)
            if (session.mode === 'reinforced') {
                if (result) { 
                    // result ở đây có thể là 'present' (nếu chưa end session) hoặc 'absent' (nếu đã end session và bị đánh vắng)
                    // Tuy nhiên để hiển thị realtime khi đang chạy monitor:
                    if (session.active) {
                         if (sessionLog) {
                            status = 'present';
                            checkInTime = sessionLog.checkInTime;
                        } else {
                            status = 'missing'; // Đang thiếu, chưa quét
                            checkInTime = result.firstCheckIn;
                        }
                    } else {
                        // Session đã đóng: Dựa hoàn toàn vào Result (đã được update bởi hàm endSession)
                        status = result.status; // 'present' hoặc 'absent'
                        checkInTime = result.firstCheckIn;
                        
                        // Fallback: Nếu logic endSession chưa chạy xong hoặc lỗi, hiển thị dựa vào log
                        if (result.status === 'present' && !sessionLog) {
                             status = 'missing'; // Đã kết thúc mà vẫn present nhưng không có log -> Anomalies
                        }
                    }
                } else {
                    status = 'absent';
                }
            } else {
                // Standard / History
                if (result) {
                    status = result.status;
                    checkInTime = result.firstCheckIn;
                }
            }

            return {
                userId: student.userId,
                fullName: student.fullName,
                status: status,
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