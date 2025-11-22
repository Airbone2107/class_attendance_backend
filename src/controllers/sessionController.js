const Session = require('../models/session.model');
const Class = require('../models/class.model');
const { randomBytes } = require('crypto');

// @desc    Giảng viên tạo một phiên điểm danh mới
// @route   POST /api/sessions/create
// @access  Private (Teacher only)
const createSession = async (req, res) => {
  // Middleware 'protect' đã xác thực và gán req.user
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ error: 'Only teachers can create sessions.' });
  }
  
  const { classId, level } = req.body;
  if (!classId || !level) {
    return res.status(400).json({ error: 'Please provide classId and level.' });
  }

  try {
    // Kiểm tra xem lớp học có tồn tại không
    const classExists = await Class.findOne({ classId });
    if (!classExists) {
      return res.status(404).json({ error: `Class with ID ${classId} not found.` });
    }

    // Tạo sessionId ngẫu nhiên, an toàn
    const sessionId = randomBytes(4).toString('hex').toUpperCase();

    const newSession = new Session({
      sessionId,
      class: classExists._id,
      level
    });

    await newSession.save();

    res.status(201).json({
      message: 'Session created successfully.',
      sessionId: newSession.sessionId,
      level: newSession.level,
      expiresAt: new Date(newSession.createdAt.getTime() + 2 * 60000) // Thông báo thời gian hết hạn
    });

  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Server error while creating session.' });
  }
};

module.exports = { createSession };