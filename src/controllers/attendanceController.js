const Session = require('../models/session.model');
const User = require('../models/user.model');
const Class = require('../models/class.model');
const Exam = require('../models/exam.model'); 
const AttendanceRecord = require('../models/attendanceRecord.model');

/**
 * Thuật toán chuẩn hóa Vector (L2 Normalization)
 */
function l2Normalize(vec) {
    if (!vec || !Array.isArray(vec) || vec.length === 0) return vec;
    let sum = 0;
    for (let v of vec) sum += v * v;
    const magnitude = Math.sqrt(sum);
    if (magnitude === 0) return vec;
    return vec.map(v => v / magnitude);
}

/**
 * Chuẩn hóa ID thẻ NFC
 */
function normalizeId(id) {
    if (!id) return '';
    return id.toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Tính độ tương đồng Cosine
 */
function cosineSimilarity(vec1, vec2) {
    if (vec1.length !== vec2.length) return -1;
    let dotProduct = 0;
    for (let i = 0; i < vec1.length; i++) {
        dotProduct += vec1[i] * vec2[i];
    }
    return dotProduct;
}

const COSINE_MATCH_THRESHOLD = 0.4; 

// Hàm helper để tìm bản ghi điểm danh hiện có
async function findExistingRecord(studentId, session) {
    let filter = { student: studentId };
    if (session.type === 'exam' && session.exam) {
        filter.exam = session.exam._id;
    } else if (session.class) {
        filter.class = session.class._id;
        filter.lessonId = session.lessonId;
    }
    return await AttendanceRecord.findOne(filter);
}

// --- API MỚI: Chặn ngay bước 1 (Validate Session) ---
const validateSession = async (req, res) => {
    try {
        const { sessionId } = req.body;
        const studentId = req.user._id;

        const session = await Session.findOne({ sessionId });
        if (!session) return res.status(404).json({ error: 'Mã phiên không tồn tại hoặc đã hết hạn.' });
        if (!session.active) return res.status(400).json({ error: 'Phiên điểm danh đã kết thúc.' });

        const existingRecord = await findExistingRecord(studentId, session);

        // LOGIC CHẶN NGHIỆP VỤ
        if (session.mode === 'standard') {
            // Chế độ thường/bổ sung: Nếu đã có record -> Báo lỗi để chặn
            if (existingRecord) {
                return res.status(400).json({ 
                    error: 'Bạn đã hoàn thành điểm danh cho buổi này rồi.',
                    block: true 
                });
            }
        } else if (session.mode === 'reinforced') {
            // Chế độ tăng cường: Nếu CHƯA có record gốc -> Báo lỗi chặn
            if (!existingRecord) {
                return res.status(400).json({ 
                    error: 'Bạn không có tên trong danh sách điểm danh ban đầu.',
                    block: true
                });
            }
            // Nếu đã có record và session id TRÙNG với session hiện tại (đã quét tăng cường rồi)
            if (existingRecord.session && existingRecord.session.toString() === session._id.toString()) {
                 return res.status(400).json({ 
                    error: 'Bạn đã hoàn thành lượt điểm danh tăng cường này rồi.',
                    block: true
                });
            }
        }

        return res.status(200).json({ message: 'Session Valid', level: session.level });

    } catch (error) {
        console.error('Validate Session Error:', error);
        res.status(500).json({ error: 'Lỗi kiểm tra phiên.' });
    }
};

const validateNfc = async (req, res) => {
    try {
        const { nfcCardId } = req.body;
        const student = await User.findById(req.user._id);
        const dbNfcId = normalizeId(student.nfcId);
        const inputNfcId = normalizeId(nfcCardId);

        if (!dbNfcId) return res.status(400).json({ error: 'Tài khoản chưa liên kết thẻ NFC.' });
        if (dbNfcId !== inputNfcId) return res.status(400).json({ error: 'Thẻ không khớp với tài khoản.' });

        return res.status(200).json({ message: 'NFC Valid' });
    } catch (error) {
        res.status(500).json({ error: 'Server error checking NFC.' });
    }
};

// API: Xử lý điểm danh (Core Logic)
const checkIn = async (req, res) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ error: 'Only students can check in.' });
  }

  const { sessionId, nfcCardId, faceEmbedding } = req.body; 
  
  if (!sessionId || !nfcCardId) {
    return res.status(400).json({ error: 'sessionId and nfcCardId are required.' });
  }

  try {
    const session = await Session.findOne({ sessionId })
        .populate('class')
        .populate('exam');

    if (!session) {
      return res.status(404).json({ error: 'Session not found or has expired.' });
    }
    
    const student = await User.findById(req.user._id);

    // 1. Xác thực thẻ vật lý
    const dbNfcId = normalizeId(student.nfcId);
    const inputNfcId = normalizeId(nfcCardId);

    if (dbNfcId !== inputNfcId) {
      return res.status(400).json({ error: 'NFC Card ID does not match.' });
    }

    // 2. Xác thực Sinh trắc học
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
      
      if (similarity < COSINE_MATCH_THRESHOLD) {
          return res.status(401).json({ 
              error: 'Khuôn mặt không khớp.', 
              details: `Độ trùng khớp: ${(similarity * 100).toFixed(1)}%` 
          });
      }
    }

    // 3. Chuẩn bị dữ liệu ghi nhận
    const recordData = {
        student: student._id,
        session: session._id, // Luôn cập nhật session ID mới nhất
        status: 'present',
        method: session.level === 3 ? 'nfc_loc' : (session.level === 2 ? 'qr_face' : 'qr')
    };

    // --- QUAN TRỌNG: XỬ LÝ THỜI GIAN ---
    // Chỉ cập nhật thời gian nếu là chế độ Standard (Lần đầu hoặc Bổ sung).
    // Nếu là Reinforced (Tăng cường), KHÔNG cập nhật checkInTime -> Giữ nguyên giờ đến lớp ban đầu.
    if (session.mode === 'standard') {
        recordData.checkInTime = new Date();
    }

    let filter = {};
    if (session.type === 'exam' && session.exam) {
        // Kiểm tra danh sách thi
        const isEligible = session.exam.students.some(s => s.equals(student._id));
        if (!isEligible) return res.status(403).json({ error: 'Bạn không có tên trong danh sách thi này.' });
        
        filter = { student: student._id, exam: session.exam._id };
        recordData.exam = session.exam._id;
    } else if (session.class) {
        filter = { student: student._id, class: session.class._id, lessonId: session.lessonId };
        recordData.class = session.class._id;
        recordData.lessonId = session.lessonId;
    }

    // Upsert: True
    // - Mode Standard: Tạo mới.
    // - Mode Reinforced: Cập nhật bản ghi cũ (Session ID thay đổi, checkInTime giữ nguyên).
    await AttendanceRecord.updateOne(filter, recordData, { upsert: true });

    res.status(200).json({
      message: 'Check-in successful!',
      classId: session.class ? session.class.classId : null,
      examId: session.exam ? session.exam.examId : null,
      lessonId: session.lessonId
    });

  } catch (error) {
    console.error('Error during check-in:', error);
    res.status(500).json({ error: 'Server error during check-in.' });
  }
};

const getStudentClasses = async (req, res) => {
    try {
        const classes = await Class.find({ students: req.user._id })
            .select('classId className credits group lessons');
        
        const result = classes.map(c => ({
            classId: c.classId,
            className: c.className,
            credits: c.credits,
            group: c.group,
            lessons: c.lessons,
            totalLessons: c.lessons.length
        }));

        res.status(200).json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching classes' });
    }
};

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
                status: record ? 'present' : (lesson.isFinished ? 'absent' : 'not_checked'),
                isFinished: lesson.isFinished
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

module.exports = { checkIn, validateNfc, validateSession, getStudentClasses, getStudentClassHistory };
