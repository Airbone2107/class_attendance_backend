const Session = require('../models/session.model');
const User = require('../models/user.model');
const Class = require('../models/class.model');
const AttendanceRecord = require('../models/attendanceRecord.model');

// @desc    Sinh viên thực hiện điểm danh
// @route   POST /api/attendance/check-in
const checkIn = async (req, res) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ error: 'Only students can check in.' });
  }

  const { sessionId, nfcCardId, faceVector } = req.body;
  if (!sessionId || !nfcCardId) {
    return res.status(400).json({ error: 'sessionId and nfcCardId are required.' });
  }

  try {
    // 1. Tìm phiên điểm danh, populate thông tin lớp để lấy classId
    const session = await Session.findOne({ sessionId }).populate('class');
    if (!session) {
      return res.status(404).json({ error: 'Session not found or has expired.' });
    }
    
    // 2. Lấy thông tin sinh viên
    const student = req.user;

    // 3. Xác thực NFC
    if (student.nfcId !== nfcCardId) {
      return res.status(400).json({ error: 'NFC Card ID does not match.' });
    }

    // 4. Xác thực Khuôn mặt
    if (session.level >= 2) {
      if (!faceVector) {
        return res.status(400).json({ error: 'Face vector is required for this level.' });
      }
      // Logic so sánh vector ở đây (bỏ qua cho demo)
    }

    // 5. GHI NHẬN KẾT QUẢ VÀO DB
    // Dùng updateOne với upsert=true để đảm bảo không bị lỗi duplicate nếu gọi lại
    await AttendanceRecord.updateOne(
        { 
            student: student._id, 
            class: session.class._id, 
            lessonId: session.lessonId 
        },
        {
            student: student._id,
            class: session.class._id,
            session: session._id,
            lessonId: session.lessonId,
            status: 'present',
            checkInTime: new Date(),
            method: session.level === 1 ? 'qr' : (session.level === 2 ? 'qr_face' : 'nfc_loc')
        },
        { upsert: true }
    );

    res.status(200).json({
      message: 'Check-in successful!',
      classId: session.class.classId, // Trả về để redirect
      lessonId: session.lessonId
    });

  } catch (error) {
    console.error('Error during check-in:', error);
    res.status(500).json({ error: 'Server error during check-in.' });
  }
};

// @desc    Lấy danh sách các lớp mà sinh viên đang học
// @route   GET /api/attendance/classes
const getStudentClasses = async (req, res) => {
    try {
        // Tìm các lớp mà mảng students có chứa ID user này
        const classes = await Class.find({ students: req.user._id })
            .select('classId className credits group lessons');
        
        // Map dữ liệu để hiển thị
        const result = classes.map(c => ({
            classId: c.classId,
            className: c.className,
            credits: c.credits,
            group: c.group,
            totalLessons: c.lessons.length
        }));

        res.status(200).json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching classes' });
    }
};

// @desc    Lấy chi tiết lịch sử điểm danh của 1 lớp (Hiển thị danh sách lesson + status)
// @route   GET /api/attendance/history/:classId
const getStudentClassHistory = async (req, res) => {
    const { classId } = req.params;
    const studentId = req.user._id;

    try {
        const classObj = await Class.findOne({ classId });
        if (!classObj) return res.status(404).json({ error: 'Class not found' });

        // Lấy tất cả record điểm danh của SV này trong lớp này
        const records = await AttendanceRecord.find({ student: studentId, class: classObj._id });

        // Ghép dữ liệu: Duyệt qua danh sách buổi học (lessons) của lớp,
        // kiểm tra xem có record tương ứng không.
        const result = classObj.lessons.map(lesson => {
            const record = records.find(r => r.lessonId === lesson.lessonId);
            return {
                lessonId: lesson.lessonId,
                date: lesson.date,
                room: lesson.room,
                shift: lesson.shift,
                // Nếu có record thì là 'present', nếu buổi học đã qua (isFinished) mà ko có record là 'absent'
                status: record ? 'present' : (lesson.isFinished ? 'absent' : 'not_checked')
            };
        });

        res.status(200).json({
            classId: classObj.classId,
            className: classObj.className,
            lessons: result
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching history' });
    }
};

module.exports = { checkIn, getStudentClasses, getStudentClassHistory };