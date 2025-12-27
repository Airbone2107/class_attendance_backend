// class_attendance_backend/src/controllers/debugController.js
const User = require('../models/user.model');
const Class = require('../models/class.model');
const Session = require('../models/session.model');
const AttendanceRecord = require('../models/attendanceRecord.model');
const AttendanceResult = require('../models/attendanceResult.model'); // MỚI
const Exam = require('../models/exam.model'); 
const { users, classes, exams } = require('../data/mockData'); 
const bcrypt = require('bcryptjs');

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
    await AttendanceResult.deleteMany({});
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
    // Lấy tất cả sinh viên
    const allStudents = createdUsers.filter(u => u.role === 'student').map(u => u._id);

    // --- CẢI TIẾN: Đảm bảo có Lịch Học Hôm Nay và Lịch Thi Ngày Mai cho TẤT CẢ sinh viên ---
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0); // 9h sáng mai

    // Tạo thêm 1 lớp học đặc biệt diễn ra HÔM NAY
    const specialClass = {
        classId: 'TODAY101',
        className: 'Lớp Demo Hôm Nay',
        credits: 2,
        group: '01',
        teacher: teacher._id,
        students: allStudents, // Tất cả SV đều học
        lessons: [
            {
                lessonId: 'L_TODAY',
                date: now, // Ngay bây giờ
                room: 'ONLINE_ZOOM',
                shift: '1-12',
                isFinished: false
            }
        ]
    };

    // Tạo thêm 1 bài thi diễn ra NGÀY MAI
    const specialExam = {
        examId: 'EXAM_TOMORROW',
        name: 'Thi Demo Ngày Mai (Auto Generated)',
        date: tomorrow,
        room: 'HALL_TEST',
        supervisor: teacher._id,
        students: allStudents, // Tất cả SV đều thi
        isFinished: false
    };

    // Gộp dữ liệu mock cũ và dữ liệu mới
    const classesToInsert = [
        ...classes.map(c => ({ ...c, teacher: teacher._id, students: allStudents })),
        specialClass
    ];

    const examsToInsert = [
        ...exams.map(e => ({ ...e, supervisor: teacher._id, students: allStudents })),
        specialExam
    ];

    // 4. Insert Classes và Exams vào DB
    const insertedClasses = await Class.insertMany(classesToInsert);
    await Exam.insertMany(examsToInsert);

    // 5. Tạo dữ liệu KẾT QUẢ điểm danh (AttendanceResult) cho quá khứ
    // KHÔNG tạo Session và AttendanceRecord (Log) để tránh phức tạp
    const attendanceResults = [];

    for (const cls of insertedClasses) {
        for (const lesson of cls.lessons) {
            const lessonDate = new Date(lesson.date);
            const isToday = lessonDate.getDate() === now.getDate() && 
                            lessonDate.getMonth() === now.getMonth() && 
                            lessonDate.getFullYear() === now.getFullYear();

            // Chỉ tạo kết quả cho các bài học trong QUÁ KHỨ (không phải hôm nay)
            if (lessonDate < now && !isToday) {
                
                // Tạo kết quả cho TẤT CẢ sinh viên trong lớp
                for (const studentId of cls.students) {
                    // Random: 70% đi học, 30% vắng
                    const isPresent = Math.random() > 0.3; 
                    
                    if (isPresent) {
                        const checkInTime = new Date(lessonDate.getTime() + 15 * 60000); // Giả lập vào trễ 15p
                        
                        // Chỉ tạo Result để hiển thị lịch sử "Có mặt"
                        attendanceResults.push({
                            student: studentId,
                            class: cls._id,
                            lessonId: lesson.lessonId,
                            status: 'present',
                            firstCheckIn: checkInTime,
                            lastCheckIn: checkInTime,
                            checkInCount: 1
                        });
                    } 
                    // Nếu vắng (else), không tạo Result -> Hệ thống tự hiểu là chưa điểm danh/vắng
                }
            }
        }
    }

    if (attendanceResults.length > 0) await AttendanceResult.insertMany(attendanceResults);

    console.log(`[DEBUG] Seeded: ${attendanceResults.length} history results (No sessions created).`);

    res.status(201).json({
      message: 'Database seeded successfully (Results Only).',
      summary: {
        users: createdUsers.length,
        classes: insertedClasses.length,
        exams: examsToInsert.length,
        results: attendanceResults.length,
        note: 'Generated Classes for TODAY and Exams for TOMORROW. Created history results without sessions.'
      }
    });
  } catch (error) {
    console.error('Seed error:', error);
    res.status(500).json({ error: 'Failed to seed database.', details: error.message });
  }
};

module.exports = { resetDb, seedDb };