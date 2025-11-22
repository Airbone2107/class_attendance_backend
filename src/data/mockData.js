const mongoose = require('mongoose');

// ID Cố định để giữ nguyên khi seed lại, giúp Frontend không bị lỗi ID cũ
const teacherId = new mongoose.Types.ObjectId('654321654321654321654321');
const studentId = new mongoose.Types.ObjectId('123456123456123456123456');

// Dữ liệu thẻ NFC giả lập
const mockNfcIds = [
  '04ADDA40C22A81', // Thẻ của SV chính (sv001)
  '04B21643C22A81',
  '04A96740C22A81',
  '04D9B241C22A81',
  '04689842C22A81'
];

const users = [
  {
    _id: teacherId,
    userId: 'gv001',
    password: 'password123',
    fullName: 'Giảng Viên Demo',
    role: 'teacher'
  },
  {
    _id: studentId,
    userId: 'sv001', // User chính để test
    password: 'password123',
    fullName: 'Nguyễn Văn A',
    role: 'student',
    nfcId: mockNfcIds[0],
    faceVector: 'mock_face_data'
  },
  // Sinh viên phụ để test thống kê số lượng
  ...mockNfcIds.slice(1).map((nfcId, index) => ({
    userId: `sv0${index + 2}`,
    password: 'password123',
    fullName: `Sinh Viên Test ${index + 2}`,
    role: 'student',
    nfcId,
    faceVector: 'mock_face_data'
  }))
];

// --- HÀM HỖ TRỢ SINH NGÀY THÁNG ĐỘNG ---

// Lấy ngày bắt đầu của tuần hiện tại (Thứ 2)
const getStartOfCurrentWeek = () => {
  const now = new Date();
  const day = now.getDay(); // 0 (Sun) -> 6 (Sat)
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
};

/**
 * Tạo danh sách 9 buổi học cho 1 môn
 * @param {number} dayOfWeekIso - 1: Thứ 2, ..., 7: Chủ nhật
 * @param {number} startHour - Giờ bắt đầu (7 hoặc 12)
 * @param {string} room - Phòng học
 * @param {string} shift - Ca học (VD: "7-11")
 */
const generateLessons = (dayOfWeekIso, startHour, room, shift) => {
  const lessons = [];
  const startOfWeek = getStartOfCurrentWeek();
  
  // Offset để tính ra ngày trong tuần mong muốn từ Thứ 2 đầu tuần
  // Thứ 2 (1) -> offset 0, Thứ 3 (2) -> offset 1...
  const dayOffset = dayOfWeekIso - 1;

  // Tạo 9 buổi: 4 buổi quá khứ (-4 đến -1), 1 buổi tuần này (0), 4 buổi tương lai (1 đến 4)
  // Tổng cộng 9 tuần liên tiếp
  for (let i = -4; i <= 4; i++) {
    const lessonDate = new Date(startOfWeek);
    // Cộng thêm số tuần (i * 7) và số ngày lệch trong tuần
    lessonDate.setDate(lessonDate.getDate() + (i * 7) + dayOffset);
    lessonDate.setHours(startHour, 0, 0, 0);

    // Xác định trạng thái buổi học
    // Nếu tuần < 0: Đã học xong (isFinished = true) -> Logic seed sẽ random vắng/có mặt
    // Nếu tuần >= 0: Chưa học hoặc đang học (isFinished = false) -> Chưa điểm danh
    const isFinished = i < 0;

    lessons.push({
      lessonId: `L${i + 5}`, // L1 -> L9
      date: lessonDate,
      room: room,
      shift: shift,
      isFinished: isFinished
    });
  }
  return lessons;
};

// --- DỮ LIỆU LỚP HỌC ---
// Được xếp lịch so le để không trùng lặp cho 1 sinh viên
const classes = [
  {
    classId: 'MAN104',
    className: 'Quản lý dự án công nghệ thông tin',
    credits: 3,
    group: '13',
    teacher: teacherId,
    students: [studentId],
    // Lịch: Thứ 2 hàng tuần, Sáng (7h)
    lessons: generateLessons(1, 7, 'E1-09.08', '7-11')
  },
  {
    classId: 'COS141',
    className: 'Phát triển ứng dụng với J2EE',
    credits: 3,
    group: '01',
    teacher: teacherId,
    students: [studentId],
    // Lịch: Thứ 3 hàng tuần, Chiều (12h30)
    lessons: generateLessons(2, 12, 'E1-09.05', '2-6') // 12h thực ra là 12h30 logic hiển thị
  },
  {
    classId: 'CAP126',
    className: 'Ngôn ngữ phát triển ứng dụng mới',
    credits: 3,
    group: '01',
    teacher: teacherId,
    students: [studentId],
    // Lịch: Thứ 4 hàng tuần, Sáng (7h)
    lessons: generateLessons(3, 7, 'B1-10.01', '7-11')
  },
  {
    classId: 'CMP436',
    className: 'Đồ án chuyên ngành CNTT',
    credits: 3,
    group: '14',
    teacher: teacherId,
    students: [studentId],
    // Lịch: Thứ 5 hàng tuần, Chiều (12h30)
    lessons: generateLessons(4, 12, 'Online', '2-6')
  }
];

module.exports = { users, classes };