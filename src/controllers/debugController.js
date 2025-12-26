// class_attendance_backend/src/controllers/debugController.js
const User = require('../models/user.model');
const Class = require('../models/class.model');
const Session = require('../models/session.model');
const AttendanceRecord = require('../models/attendanceRecord.model');
const AttendanceResult = require('../models/attendanceResult.model'); // MỚI
const Exam = require('../models/exam.model'); 
const { users, classes, exams } = require('../data/mockData'); 
const bcrypt = require('bcryptjs');
const { randomBytes } = require('crypto');

// @desc    Xóa sạch Database
// @route   POST /api/debug/reset
const resetDb = async (req, res) => {
  try {
    await User.deleteMany({});
    await Class.deleteMany({});
    await Session.deleteMany({});
    await AttendanceRecord.deleteMany({});
    await AttendanceResult.deleteMany({}); // MỚI
    await Exam.deleteMany({});

    // Drop indexes để tránh lỗi khi thay đổi schema
    await AttendanceRecord.collection.dropIndexes();
    await AttendanceResult.createIndexes();
    await AttendanceRecord.createIndexes();

    console.log('[DEBUG] Database Cleared');
    res.status(200).json({ message: 'Database cleared successfully.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to clear database.' });
  }
};

// @desc    Nạp dữ liệu mẫu (Seed)
// @route   POST /api/debug/seed
const seedDb = async (req, res) => {
  try {
    console.log('[DEBUG] Starting Seed...');
    
    // 1. Dọn dẹp trước
    await User.deleteMany({});
    await Class.deleteMany({});
    await Session.deleteMany({});
    await AttendanceRecord.deleteMany({});
    await AttendanceResult.deleteMany({}); // MỚI
    await Exam.deleteMany({});

    // 2. Hash password cho users
    const salt = await bcrypt.genSalt(10);
    const hashedUsers = await Promise.all(users.map(async (user) => {
      const hashedPassword = await bcrypt.hash(user.password, salt);
      return { ...user, password: hashedPassword };
    }));

    // 3. Tạo Users
    const createdUsers = await User.insertMany(hashedUsers);
    
    const teacher = createdUsers.find(u => u.userId === 'gv001');
    const studentA = createdUsers.find(u => u.userId === 'sv001');
    const allStudents = createdUsers.filter(u => u.role === 'student').map(u => u._id);

    // 4. Tạo Classes và Exams
    const insertedClasses = await Class.insertMany(classes.map(c => ({
        ...c,
        teacher: teacher._id,
        students: allStudents
    })));

    const insertedExams = await Exam.insertMany(exams.map(e => ({
        ...e,
        supervisor: teacher._id,
        students: [studentA._id]
    })));

    // 5. Tạo dữ liệu điểm danh ngẫu nhiên
    const attendanceLogs = [];
    const attendanceResults = [];
    const mockSessions = [];
    const now = new Date();

    for (const cls of insertedClasses) {
        for (const lesson of cls.lessons) {
            const lessonDate = new Date(lesson.date);
            
            if (lessonDate < now) {
                const sessionId = randomBytes(4).toString('hex').toUpperCase();
                
                // Session cũ
                const sessionMock = new Session({
                    sessionId: sessionId,
                    class: cls._id,
                    lessonId: lesson.lessonId, 
                    level: 1,
                    mode: 'standard',
                    active: false,
                    createdAt: new Date(lessonDate.getTime() + 60 * 60 * 1000)
                });
                mockSessions.push(sessionMock);

                // SV chính (sv001) - 70% đi học
                const isPresent = Math.random() > 0.3; 
                if (isPresent) {
                    const checkInTime = new Date(lessonDate.getTime() + 15 * 60000);
                    
                    // Tạo Log
                    attendanceLogs.push({
                        student: studentA._id,
                        class: cls._id,
                        session: sessionMock._id,
                        lessonId: lesson.lessonId,
                        status: 'present',
                        method: Math.random() > 0.5 ? 'qr' : 'nfc',
                        checkInTime: checkInTime
                    });

                    // Tạo Result
                    attendanceResults.push({
                        student: studentA._id,
                        class: cls._id,
                        lessonId: lesson.lessonId,
                        status: 'present',
                        firstCheckIn: checkInTime,
                        lastCheckIn: checkInTime,
                        checkInCount: 1
                    });
                }
            }
        }
    }

    if (mockSessions.length > 0) await Session.insertMany(mockSessions);
    if (attendanceLogs.length > 0) await AttendanceRecord.insertMany(attendanceLogs);
    if (attendanceResults.length > 0) await AttendanceResult.insertMany(attendanceResults);

    console.log(`[DEBUG] Seeded: ${mockSessions.length} sessions, ${attendanceLogs.length} logs, ${attendanceResults.length} results`);

    res.status(201).json({
      message: 'Database seeded successfully.',
      summary: {
        users: createdUsers.length,
        classes: insertedClasses.length,
        sessions: mockSessions.length,
        logs: attendanceLogs.length,
        results: attendanceResults.length
      }
    });
  } catch (error) {
    console.error('Seed error:', error);
    res.status(500).json({ error: 'Failed to seed database.', details: error.message });
  }
};

module.exports = { resetDb, seedDb };