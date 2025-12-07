// class_attendance_backend/src/controllers/attendanceController.js

const Session = require('../models/session.model');
const User = require('../models/user.model');
const Class = require('../models/class.model');
const AttendanceRecord = require('../models/attendanceRecord.model');

// Hàm chuẩn hóa L2 (đưa vector về độ dài đơn vị)
function l2Normalize(vec) {
    if (!vec || !Array.isArray(vec) || vec.length === 0) return vec;
    
    let sum = 0;
    for (let v of vec) sum += v * v;
    const magnitude = Math.sqrt(sum);
    
    if (magnitude === 0) return vec;
    return vec.map(v => v / magnitude);
}

// Hàm chuẩn hóa ID thẻ để so sánh (In hoa, xóa khoảng trắng)
function normalizeId(id) {
    if (!id) return '';
    return id.toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, ''); // Chỉ giữ lại chữ số và chữ cái
}

// --- SỬA ĐỔI ---
// Sử dụng Cosine Similarity thay vì Euclidean Distance để giống Project gốc
function cosineSimilarity(vec1, vec2) {
    if (vec1.length !== vec2.length) return -1; // Lỗi kích thước
    
    let dotProduct = 0;
    for (let i = 0; i < vec1.length; i++) {
        dotProduct += vec1[i] * vec2[i];
    }
    return dotProduct;
}

// Ngưỡng chấp nhận (Threshold)
const COSINE_MATCH_THRESHOLD = 0.4; 

// @desc    Sinh viên thực hiện điểm danh
// @route   POST /api/attendance/check-in
const checkIn = async (req, res) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ error: 'Only students can check in.' });
  }

  const { sessionId, nfcCardId, faceEmbedding } = req.body; 
  
  if (!sessionId || !nfcCardId) {
    return res.status(400).json({ error: 'sessionId and nfcCardId are required.' });
  }

  try {
    const session = await Session.findOne({ sessionId }).populate('class');
    if (!session) {
      return res.status(404).json({ error: 'Session not found or has expired.' });
    }
    
    const student = await User.findById(req.user._id);

    // --- DEBUG LOG START ---
    const dbNfcId = normalizeId(student.nfcId);
    const inputNfcId = normalizeId(nfcCardId);

    console.log('--- CHECK-IN ATTEMPT ---');
    console.log(`User: ${student.fullName} (${student.userId})`);
    console.log(`Stored NFC in DB: '${dbNfcId}'`);
    console.log(`Scanned NFC     : '${inputNfcId}'`);
    console.log(`Match Result    : ${dbNfcId === inputNfcId}`);
    console.log('------------------------');
    // --- DEBUG LOG END ---

    // 1. Xác thực NFC (So sánh chuỗi đã chuẩn hóa)
    if (!dbNfcId) {
        return res.status(400).json({ error: 'Tài khoản của bạn chưa được liên kết với thẻ NFC nào trong hệ thống.' });
    }

    if (dbNfcId !== inputNfcId) {
      return res.status(400).json({ error: `Thẻ không hợp lệ. Thẻ này không thuộc về tài khoản ${student.userId}.` });
    }

    // 2. Xác thực Khuôn mặt (Nếu Level >= 2)
    if (session.level >= 2) {
      if (!faceEmbedding || !Array.isArray(faceEmbedding)) {
        return res.status(400).json({ error: 'Face data is required for this level.' });
      }

      if (!student.faceEmbedding || student.faceEmbedding.length === 0) {
         return res.status(400).json({ error: 'Bạn chưa đăng ký khuôn mặt trong Cài đặt.' });
      }

      const normalizedInput = l2Normalize(faceEmbedding);
      const normalizedStored = l2Normalize(student.faceEmbedding);

      const similarity = cosineSimilarity(normalizedInput, normalizedStored);
      
      console.log(`[Face Auth] User: ${student.userId}, Similarity: ${similarity.toFixed(4)}`);

      if (similarity < COSINE_MATCH_THRESHOLD) {
          return res.status(401).json({ 
              error: 'Khuôn mặt không khớp.', 
              details: `Độ trùng khớp: ${(similarity * 100).toFixed(1)}% (Yêu cầu > ${COSINE_MATCH_THRESHOLD * 100}%)` 
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
        const classes = await Class.find({ students: req.user._id })
            .select('classId className credits group lessons');
        
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

// @desc    Lấy chi tiết lịch sử điểm danh của 1 lớp
// @route   GET /api/attendance/history/:classId
const getStudentClassHistory = async (req, res) => {
    const { classId } = req.params;
    const studentId = req.user._id;

    try {
        const classObj = await Class.findOne({ classId });
        if (!classObj) return res.status(404).json({ error: 'Class not found' });

        const records = await AttendanceRecord.find({ student: studentId, class: classObj._id });

        const result = classObj.lessons.map(lesson => {
            const record = records.find(r => r.lessonId === lesson.lessonId);
            return {
                lessonId: lesson.lessonId,
                date: lesson.date,
                room: lesson.room,
                shift: lesson.shift,
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