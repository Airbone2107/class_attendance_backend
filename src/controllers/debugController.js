// class_attendance_backend/src/controllers/debugController.js
const User = require('../models/user.model');
const Class = require('../models/class.model');
const Session = require('../models/session.model');
const AttendanceRecord = require('../models/attendanceRecord.model');
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
    await Exam.deleteMany({});

    await AttendanceRecord.syncIndexes();

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
    await Exam.deleteMany({});

    await AttendanceRecord.syncIndexes();

    // 2. Hash password cho users
    const salt = await bcrypt.genSalt(10);
    const hashedUsers = await Promise.all(users.map(async (user) => {
      const hashedPassword = await bcrypt.hash(user.password, salt);
      return { ...user, password: hashedPassword };
    }));

    // 3. Tạo Users
    const createdUsers = await User.insertMany(hashedUsers);
    console.log(`[DEBUG] Created ${createdUsers.length} users`);

    // 4. Map lại ID user thật
    const teacher = createdUsers.find(u => u.userId === 'gv001');
    const studentA = createdUsers.find(u => u.userId === 'sv001'); // SV chính
    const allStudents = createdUsers.filter(u => u.role === 'student').map(u => u._id);

    // 5. Chuẩn bị dữ liệu Classes và Exams
    // Chuyển đổi sang object thuần để tránh vấn đề với Mongoose Document trong vòng lặp sau này
    const insertedClasses = await Class.insertMany(classes.map(c => ({
        ...c,
        teacher: teacher._id,
        students: allStudents
    })));
    console.log(`[DEBUG] Created ${insertedClasses.length} classes`);

    const insertedExams = await Exam.insertMany(exams.map(e => ({
        ...e,
        supervisor: teacher._id,
        students: [studentA._id]
    })));

    // 6. Tạo dữ liệu điểm danh ngẫu nhiên & TẠO SESSION
    const attendanceRecords = [];
    const mockSessions = [];
    const now = new Date();

    for (const cls of insertedClasses) {
        // Nếu insertedClasses là Mongoose Document, truy cập .lessons trực tiếp vẫn ổn
        // Nhưng để chắc chắn, ta dùng cls.toObject() nếu cần, hoặc truy cập thẳng.
        // Ở đây cls là document trả về từ insertMany.
        
        for (const lesson of cls.lessons) {
            const lessonDate = new Date(lesson.date);
            
            // SỬA LỖI: Kiểm tra ngày giờ thay vì flag isFinished
            // Nếu buổi học ở quá khứ => Tạo Session cũ + Điểm danh
            if (lessonDate < now) {
                
                const sessionId = randomBytes(4).toString('hex').toUpperCase();
                
                // Tạo Session giả cho buổi học cũ
                const sessionMock = new Session({
                    sessionId: sessionId,
                    class: cls._id,
                    lessonId: lesson.lessonId, 
                    level: 1,
                    mode: 'standard',
                    active: false, // Session cũ đã đóng
                    createdAt: new Date(lessonDate.getTime() + 60 * 60 * 1000) // Tạo sau giờ học 1 tiếng
                });
                mockSessions.push(sessionMock);

                // Tạo record điểm danh ngẫu nhiên cho SV chính
                const isPresent = Math.random() > 0.3; // 70% đi học
                if (isPresent) {
                    attendanceRecords.push({
                        student: studentA._id,
                        class: cls._id,
                        session: sessionMock._id, // Link tới session vừa tạo
                        lessonId: lesson.lessonId,
                        status: 'present',
                        method: Math.random() > 0.5 ? 'qr' : 'nfc',
                        checkInTime: new Date(lessonDate.getTime() + 15 * 60000)
                    });
                }
            }
        }
    }

    console.log(`[DEBUG] Preparing to insert ${mockSessions.length} sessions...`);

    if (mockSessions.length > 0) {
        await Session.insertMany(mockSessions);
        console.log(`[DEBUG] Inserted ${mockSessions.length} sessions successfully`);
    } else {
        console.log('[DEBUG] WARNING: No past lessons found to create sessions for.');
    }

    if (attendanceRecords.length > 0) {
        await AttendanceRecord.insertMany(attendanceRecords);
        console.log(`[DEBUG] Inserted ${attendanceRecords.length} attendance records`);
    }

    res.status(201).json({
      message: 'Database seeded successfully.',
      summary: {
        users: createdUsers.length,
        classes: insertedClasses.length,
        sessions: mockSessions.length,
        records: attendanceRecords.length
      }
    });
  } catch (error) {
    console.error('Seed error:', error);
    res.status(500).json({ error: 'Failed to seed database.', details: error.message });
  }
};

module.exports = { resetDb, seedDb };