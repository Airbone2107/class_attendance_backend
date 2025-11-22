const Session = require('../models/session.model');
const User = require('../models/user.model');

// @desc    Sinh viên thực hiện điểm danh
// @route   POST /api/attendance/check-in
// @access  Private (Student only)
const checkIn = async (req, res) => {
  // Middleware 'protect' đã xác thực và gán req.user
  if (req.user.role !== 'student') {
    return res.status(403).json({ error: 'Only students can check in.' });
  }

  const { sessionId, nfcCardId, faceVector } = req.body;
  if (!sessionId || !nfcCardId) {
    return res.status(400).json({ error: 'sessionId and nfcCardId are required.' });
  }

  try {
    // 1. Tìm phiên điểm danh
    const session = await Session.findOne({ sessionId });
    if (!session) {
      // Session có thể đã hết hạn và bị MongoDB tự động xóa
      return res.status(404).json({ error: 'Session not found or has expired.' });
    }
    
    // 2. Lấy thông tin sinh viên đang điểm danh từ req.user (đã được middleware xử lý)
    const student = req.user;

    // 3. Xác thực NFC
    if (student.nfcId !== nfcCardId) {
      return res.status(400).json({ error: 'NFC Card ID does not match.' });
    }

    // 4. Xác thực Khuôn mặt (nếu level yêu cầu)
    if (session.level === 2 || session.level === 3) {
      if (!faceVector) {
        return res.status(400).json({ error: 'Face vector is required for this level.' });
      }
      // Logic so sánh faceVector thực tế sẽ ở đây.
      // Vì đây là giả lập, chúng ta chỉ cần kiểm tra sự tồn tại của nó.
      console.log(`Face vector received for Level ${session.level} check-in.`);
    }

    // 5. Ghi nhận kết quả (Trong thực tế, bạn sẽ tạo một bản ghi AttendanceRecord)
    // Để đơn giản cho demo, chúng ta chỉ trả về thành công.
    res.status(200).json({
      message: 'Check-in successful!',
      student: {
        userId: student.userId,
        fullName: student.fullName
      },
      session: {
        sessionId: session.sessionId,
        level: session.level
      }
    });

  } catch (error) {
    console.error('Error during check-in:', error);
    res.status(500).json({ error: 'Server error during check-in.' });
  }
};

module.exports = { checkIn };