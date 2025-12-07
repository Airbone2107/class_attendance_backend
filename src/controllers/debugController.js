// class_attendance_backend/src/controllers/debugController.js
const User = require('../models/user.model');
const Class = require('../models/class.model');
const Session = require('../models/session.model');
const AttendanceRecord = require('../models/attendanceRecord.model');
const Exam = require('../models/exam.model'); // <-- MỚI
const { users, classes, exams } = require('../data/mockData'); // <-- Lấy exams
const bcrypt = require('bcryptjs');

// @desc    Xóa sạch Database
// @route   POST /api/debug/reset
const resetDb = async (req, res) => {
  try {
    await User.deleteMany({});
    await Class.deleteMany({});
    await Session.deleteMany({});
    await AttendanceRecord.deleteMany({});
    await Exam.deleteMany({}); // <-- MỚI

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
    // 1. Dọn dẹp trước
    await User.deleteMany({});
    await Class.deleteMany({});
    await Session.deleteMany({});
    await AttendanceRecord.deleteMany({});
    await Exam.deleteMany({});

    // 2. Hash password cho users
    const salt = await bcrypt.genSalt(10);
    const hashedUsers = await Promise.all(users.map(async (user) => {
      const hashedPassword = await bcrypt.hash(user.password, salt);
      return { ...user, password: hashedPassword };
    }));

    // 3. Tạo Users
    const createdUsers = await User.insertMany(hashedUsers);

    // 4. Map lại ID user thật
    const teacher = createdUsers.find(u => u.userId === 'gv001');
    const studentA = createdUsers.find(u => u.userId === 'sv001'); // SV chính
    const allStudents = createdUsers.filter(u => u.role === 'student').map(u => u._id);

    // 5. Chuẩn bị dữ liệu Classes và Exams
    
    // Insert Classes
    const insertedClasses = await Class.insertMany(classes.map(c => ({
        ...c,
        teacher: teacher._id,
        students: allStudents
    })));

    // Insert Exams (MỚI)
    const insertedExams = await Exam.insertMany(exams.map(e => ({
        ...e,
        supervisor: teacher._id,
        students: [studentA._id] // Mock: Chỉ SV chính được thi
    })));

    // 6. Tạo dữ liệu điểm danh ngẫu nhiên cho các buổi học cũ
    const attendanceRecords = [];
    for (const cls of insertedClasses) {
        for (const lesson of cls.lessons) {
            if (lesson.isFinished) {
                const isPresent = Math.random() > 0.3;
                if (isPresent) {
                    attendanceRecords.push({
                        student: studentA._id,
                        class: cls._id,
                        lessonId: lesson.lessonId,
                        status: 'present',
                        method: Math.random() > 0.5 ? 'qr' : 'nfc',
                        checkInTime: new Date(lesson.date.getTime() + 15 * 60000)
                    });
                }
            }
        }
    }

    if (attendanceRecords.length > 0) {
        await AttendanceRecord.insertMany(attendanceRecords);
    }

    res.status(201).json({
      message: 'Database seeded successfully with Exams.',
      summary: {
        users: createdUsers.length,
        classes: insertedClasses.length,
        exams: insertedExams.length, // <-- Report
        attendance_records: attendanceRecords.length
      }
    });
  } catch (error) {
    console.error('Seed error:', error);
    res.status(500).json({ error: 'Failed to seed database.', details: error.message });
  }
};

module.exports = { resetDb, seedDb };