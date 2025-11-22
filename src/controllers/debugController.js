// class_attendance_backend/src/controllers/debugController.js
const User = require('../models/user.model');
const Class = require('../models/class.model');
const Session = require('../models/session.model');
const AttendanceRecord = require('../models/attendanceRecord.model');
const { users, classes } = require('../data/mockData');
const bcrypt = require('bcryptjs');

// @desc    Xóa sạch Database
// @route   POST /api/debug/reset
const resetDb = async (req, res) => {
  try {
    await User.deleteMany({});
    await Class.deleteMany({});
    await Session.deleteMany({});
    await AttendanceRecord.deleteMany({});

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

    // 5. Chuẩn bị dữ liệu Classes và AttendanceRecords
    const finalClasses = [];
    const attendanceRecords = [];

    for (const clsData of classes) {
      // Gán ID thật
      const classObj = {
        ...clsData,
        teacher: teacher._id,
        students: allStudents 
      };
      
      // Tạo Class Document để lấy _id trước (cần cho AttendanceRecord)
      // Lưu ý: insertMany sẽ trả về documents có _id
    }
    
    // Insert Classes trước để có _id thật
    const insertedClasses = await Class.insertMany(classes.map(c => ({
        ...c,
        teacher: teacher._id,
        students: allStudents
    })));

    // 6. Tạo dữ liệu điểm danh ngẫu nhiên cho các buổi học ĐÃ KẾT THÚC (isFinished = true)
    // Chỉ tạo cho sinh viên chính (sv001) để dễ demo
    for (const cls of insertedClasses) {
        for (const lesson of cls.lessons) {
            if (lesson.isFinished) {
                // Random: 70% cơ hội là có mặt (tạo record), 30% là vắng (không tạo record)
                const isPresent = Math.random() > 0.3;
                
                if (isPresent) {
                    attendanceRecords.push({
                        student: studentA._id,
                        class: cls._id,
                        lessonId: lesson.lessonId,
                        status: 'present',
                        method: Math.random() > 0.5 ? 'qr' : 'nfc', // Random method
                        checkInTime: new Date(lesson.date.getTime() + 15 * 60000) // Check in sau 15p
                    });
                }
                // Nếu vắng (absent) thì KHÔNG tạo record nào cả. 
                // Logic frontend/backend khi query history sẽ tự hiểu: 
                // Lesson đã qua (isFinished) + Không có record = Vắng.
            }
        }
    }

    // 7. Insert Attendance Records
    if (attendanceRecords.length > 0) {
        await AttendanceRecord.insertMany(attendanceRecords);
    }

    res.status(201).json({
      message: 'Database seeded successfully with dynamic dates.',
      summary: {
        users: createdUsers.length,
        classes: insertedClasses.length,
        attendance_records_created: attendanceRecords.length,
        note: "Lessons before today are randomly marked present/absent."
      }
    });
  } catch (error) {
    console.error('Seed error:', error);
    res.status(500).json({ error: 'Failed to seed database.', details: error.message });
  }
};

module.exports = { resetDb, seedDb };