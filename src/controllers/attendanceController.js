// class_attendance_backend/src/controllers/attendanceController.js

const Session = require('../models/session.model');
const User = require('../models/user.model');
const Class = require('../models/class.model');
const Exam = require('../models/exam.model'); 
const AttendanceRecord = require('../models/attendanceRecord.model');

// ... (Giữ nguyên các hàm helper: l2Normalize, normalizeId, cosineSimilarity, validateNfc) ...
function l2Normalize(vec) {
    if (!vec || !Array.isArray(vec) || vec.length === 0) return vec;
    let sum = 0;
    for (let v of vec) sum += v * v;
    const magnitude = Math.sqrt(sum);
    if (magnitude === 0) return vec;
    return vec.map(v => v / magnitude);
}

function normalizeId(id) {
    if (!id) return '';
    return id.toString().trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function cosineSimilarity(vec1, vec2) {
    if (vec1.length !== vec2.length) return -1;
    let dotProduct = 0;
    for (let i = 0; i < vec1.length; i++) {
        dotProduct += vec1[i] * vec2[i];
    }
    return dotProduct;
}

const COSINE_MATCH_THRESHOLD = 0.4; 

const validateNfc = async (req, res) => {
    try {
        const { nfcCardId } = req.body;
        const student = await User.findById(req.user._id);

        const dbNfcId = normalizeId(student.nfcId);
        const inputNfcId = normalizeId(nfcCardId);

        console.log(`[NFC Validate] User: ${student.userId} | DB: ${dbNfcId} | Input: ${inputNfcId}`);

        if (!dbNfcId) {
             return res.status(400).json({ error: 'Tài khoản chưa liên kết thẻ NFC.' });
        }

        if (dbNfcId !== inputNfcId) {
            return res.status(400).json({ error: 'Thẻ không khớp với tài khoản sinh viên.' });
        }

        return res.status(200).json({ message: 'NFC Valid' });

    } catch (error) {
        console.error('NFC Validation Error:', error);
        res.status(500).json({ error: 'Server error checking NFC.' });
    }
};

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

    // 1. Validate NFC
    const dbNfcId = normalizeId(student.nfcId);
    const inputNfcId = normalizeId(nfcCardId);

    if (dbNfcId !== inputNfcId) {
      return res.status(400).json({ error: 'NFC Card ID does not match.' });
    }

    // 2. Validate Face (Level >= 2)
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
              details: `Độ trùng khớp: ${(similarity * 100).toFixed(1)}%` 
          });
      }
    }

    // 3. Ghi nhận kết quả
    const recordData = {
        student: student._id,
        session: session._id,
        status: 'present',
        checkInTime: new Date(),
        method: session.level === 3 ? 'nfc_loc' : (session.level === 2 ? 'qr_face' : 'qr')
    };

    let filter = {};

    if (session.type === 'exam' && session.exam) {
        const isEligible = session.exam.students.some(s => s.equals(student._id));
        if (!isEligible) {
            return res.status(403).json({ error: 'Bạn không có tên trong danh sách thi này.' });
        }

        filter = { student: student._id, exam: session.exam._id };
        recordData.exam = session.exam._id;
    } else if (session.class) {
        filter = { student: student._id, class: session.class._id, lessonId: session.lessonId };
        recordData.class = session.class._id;
        recordData.lessonId = session.lessonId;
    } else {
        return res.status(500).json({ error: 'Invalid session data.' });
    }

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
            .select('classId className credits group lessons'); // Đã select lessons
        
        const result = classes.map(c => ({
            classId: c.classId,
            className: c.className,
            credits: c.credits,
            group: c.group,
            lessons: c.lessons, // <-- QUAN TRỌNG: Phải trả về danh sách lessons thì Frontend mới render được TKB
            totalLessons: c.lessons.length
        }));

        res.status(200).json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching classes' });
    }
};

// ... (Giữ nguyên getStudentClassHistory) ...
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
                isFinished: lesson.isFinished // Bổ sung để Frontend dùng
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

module.exports = { checkIn, validateNfc, getStudentClasses, getStudentClassHistory };