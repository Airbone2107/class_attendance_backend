const Session = require('../models/session.model');
const User = require('../models/user.model');
const Class = require('../models/class.model');
const AttendanceRecord = require('../models/attendanceRecord.model');

// Hàm tính khoảng cách Euclid giữa 2 vector
function euclideanDistance(vec1, vec2) {
    if (vec1.length !== vec2.length) return Infinity;
    let sum = 0;
    for (let i = 0; i < vec1.length; i++) {
        sum += Math.pow(vec1[i] - vec2[i], 2);
    }
    return Math.sqrt(sum);
}

// Ngưỡng chấp nhận (Threshold) - Cần tinh chỉnh tùy model FaceNet
// Với FaceNet chuẩn, thường là 0.6 đến 1.0 tùy cách normalize
const FACE_MATCH_THRESHOLD = 1.0; 

// @desc    Sinh viên thực hiện điểm danh
// @route   POST /api/attendance/check-in
const checkIn = async (req, res) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ error: 'Only students can check in.' });
  }

  // faceEmbedding gửi lên từ App là mảng số
  const { sessionId, nfcCardId, faceEmbedding } = req.body; 
  
  if (!sessionId || !nfcCardId) {
    return res.status(400).json({ error: 'sessionId and nfcCardId are required.' });
  }

  try {
    const session = await Session.findOne({ sessionId }).populate('class');
    if (!session) {
      return res.status(404).json({ error: 'Session not found or has expired.' });
    }
    
    // Lấy thông tin sinh viên đầy đủ từ DB để có faceEmbedding đã lưu
    const student = await User.findById(req.user._id);

    // 1. Xác thực NFC
    if (student.nfcId !== nfcCardId) {
      return res.status(400).json({ error: 'NFC Card ID does not match.' });
    }

    // 2. Xác thực Khuôn mặt (Nếu Level >= 2)
    if (session.level >= 2) {
      if (!faceEmbedding || !Array.isArray(faceEmbedding)) {
        return res.status(400).json({ error: 'Face data is required for this level.' });
      }

      if (!student.faceEmbedding || student.faceEmbedding.length === 0) {
         return res.status(400).json({ error: 'Bạn chưa đăng ký khuôn mặt trong Cài đặt.' });
      }

      // So sánh vector gửi lên với vector trong DB
      const distance = euclideanDistance(faceEmbedding, student.faceEmbedding);
      console.log(`[Face Auth] User: ${student.userId}, Distance: ${distance}`);

      if (distance > FACE_MATCH_THRESHOLD) {
          return res.status(401).json({ 
              error: 'Khuôn mặt không khớp.', 
              details: `Độ sai lệch: ${distance.toFixed(2)} (Ngưỡng: ${FACE_MATCH_THRESHOLD})` 
          });
      }
    }

    // 3. Ghi nhận kết quả
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
      classId: session.class.classId,
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