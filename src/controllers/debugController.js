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

    // 4. Map lại ID user thật (để đảm bảo logic ref của mongoose hoạt động đúng)
    // Lấy user gv001
    const teacher = createdUsers.find(u => u.userId === 'gv001');
    // Lấy danh sách tất cả sinh viên
    const students = createdUsers.filter(u => u.role === 'student').map(u => u._id);

    // 5. Cập nhật Classes với ID thật
    const finalClasses = classes.map((cls) => ({
      ...cls,
      teacher: teacher._id,
      students: students // Gán tất cả sinh viên mock vào lớp để dễ test
    }));

    // 6. Tạo Classes
    await Class.insertMany(finalClasses);

    res.status(201).json({
      message: 'Database seeded successfully.',
      summary: {
        users: createdUsers.length,
        classes: finalClasses.length,
        students_per_class: students.length
      }
    });
  } catch (error) {
    console.error('Seed error:', error);
    res.status(500).json({ error: 'Failed to seed database.', details: error.message });
  }
};

module.exports = { resetDb, seedDb };


