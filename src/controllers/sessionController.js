const Session = require('../models/session.model');
const Class = require('../models/class.model');
const AttendanceRecord = require('../models/attendanceRecord.model');
const { randomBytes } = require('crypto');

// @desc    Giảng viên tạo phiên điểm danh cho 1 buổi học cụ thể
// @route   POST /api/sessions/create
const createSession = async (req, res) => {
  if (req.user.role !== 'teacher') {
    return res.status(403).json({ error: 'Only teachers can create sessions.' });
  }
  
  // lessonId là bắt buộc để biết điểm danh cho buổi nào
  const { classId, lessonId, level } = req.body;
  if (!classId || !lessonId || !level) {
    return res.status(400).json({ error: 'Please provide classId, lessonId and level.' });
  }

  try {
    // Kiểm tra lớp học
    const classExists = await Class.findOne({ classId });
    if (!classExists) {
      return res.status(404).json({ error: `Class with ID ${classId} not found.` });
    }

    // Kiểm tra xem lessonId có thuộc lớp này không
    const lessonExists = classExists.lessons.find(l => l.lessonId === lessonId);
    if (!lessonExists) {
        return res.status(404).json({ error: `Lesson ${lessonId} not found in class ${classId}.` });
    }

    // Xóa session cũ của buổi học này nếu có (để tạo lại)
    await Session.deleteMany({ class: classExists._id, lessonId: lessonId });

    // Tạo sessionId ngẫu nhiên
    const sessionId = randomBytes(4).toString('hex').toUpperCase();

    const newSession = new Session({
      sessionId,
      class: classExists._id,
      lessonId,
      level
    });

    await newSession.save();

    res.status(201).json({
      message: 'Session created successfully.',
      sessionId: newSession.sessionId,
      level: newSession.level,
      // Trả về thời gian hết hạn để frontend đếm ngược (5 phút)
      expiresAt: new Date(newSession.createdAt.getTime() + 5 * 60000)
    });

  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Server error while creating session.' });
  }
};

// @desc    Lấy thống kê phiên điểm danh (cho màn hình monitor của GV)
// @route   GET /api/sessions/:sessionId/stats
const getSessionStats = async (req, res) => {
    const { sessionId } = req.params;
    try {
        const session = await Session.findOne({ sessionId });
        if (!session) {
            return res.status(404).json({ error: 'Session not found or expired' });
        }

        // Đếm số lượng record điểm danh thuộc session này
        const count = await AttendanceRecord.countDocuments({ session: session._id });
        
        res.status(200).json({
            sessionId,
            count,
            expiresAt: new Date(session.createdAt.getTime() + 5 * 60000)
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching stats' });
    }
};

module.exports = { createSession, getSessionStats };