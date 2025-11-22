const mongoose = require('mongoose');

// ID Cố định để giữ nguyên khi seed lại
const teacherId = new mongoose.Types.ObjectId('654321654321654321654321');
const studentId = new mongoose.Types.ObjectId('123456123456123456123456');

// Dữ liệu thẻ NFC giả lập
const mockNfcIds = [
  '04ADDA40C22A81', // Thẻ của SV chính
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
    userId: 'sv001', // User trong ảnh
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

// Helper tạo ngày tháng tương đối
const getDate = (dayOffset, hour = 7, minute = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, minute, 0, 0);
  return d;
};

const classes = [
  {
    classId: 'MAN104',
    className: 'Quản lý dự án công nghệ thông tin',
    credits: 3,
    group: '13',
    teacher: teacherId,
    students: [studentId], // Gán SV vào lớp
    lessons: [
      // Khớp với ảnh: Thứ 2, 17/11/2025
      { lessonId: 'L1', date: new Date('2025-11-10T07:00:00'), room: 'E1-09.08', shift: '7-11', isFinished: true },
      { lessonId: 'L2', date: new Date('2025-11-17T07:00:00'), room: 'E1-09.08', shift: '7-11', isFinished: false },
      { lessonId: 'L3', date: new Date('2025-11-24T07:00:00'), room: 'E1-09.08', shift: '7-11', isFinished: false },
      { lessonId: 'L4', date: new Date('2025-12-01T07:00:00'), room: 'E1-09.08', shift: '7-11', isFinished: false }
    ]
  },
  {
    classId: 'COS141',
    className: 'Phát triển ứng dụng với J2EE',
    credits: 3,
    group: '01',
    teacher: teacherId,
    students: [studentId],
    lessons: [
      // Khớp với ảnh: Thứ 3, 18/11/2025
      { lessonId: 'L1', date: new Date('2025-11-11T12:30:00'), room: 'E1-09.05', shift: '2-6', isFinished: true },
      { lessonId: 'L2', date: new Date('2025-11-18T12:30:00'), room: 'E1-09.05', shift: '2-6', isFinished: false },
      { lessonId: 'L3', date: new Date('2025-11-25T12:30:00'), room: 'E1-09.05', shift: '2-6', isFinished: false }
    ]
  },
  {
    classId: 'CAP126',
    className: 'Ngôn ngữ phát triển ứng dụng mới',
    credits: 3,
    group: '01',
    teacher: teacherId,
    students: [studentId],
    lessons: [
      { lessonId: 'L1', date: new Date('2025-09-04T12:30:00'), room: 'B1-10.01', shift: '2-6', isFinished: true },
      { lessonId: 'L2', date: new Date('2025-09-11T12:30:00'), room: 'B1-10.01', shift: '2-6', isFinished: true },
      { lessonId: 'L3', date: new Date('2025-09-18T12:30:00'), room: 'B1-10.01', shift: '2-6', isFinished: true },
      { lessonId: 'L4', date: new Date('2025-09-25T12:30:00'), room: 'B1-10.01', shift: '2-6', isFinished: true },
      { lessonId: 'L5', date: new Date('2025-10-02T12:30:00'), room: 'B1-10.01', shift: '2-6', isFinished: true },
      { lessonId: 'L6', date: new Date('2025-10-09T12:30:00'), room: 'B1-10.01', shift: '2-6', isFinished: true },
      { lessonId: 'L7', date: new Date('2025-10-16T12:30:00'), room: 'B1-10.01', shift: '2-6', isFinished: false },
    ]
  },
  {
    classId: 'CMP436',
    className: 'Đồ án chuyên ngành Công nghệ thông tin',
    credits: 3,
    group: '14 Tổ: 05',
    teacher: teacherId,
    students: [studentId],
    lessons: [
      { lessonId: 'L1', date: new Date('2025-11-15T07:00:00'), room: 'Online', shift: '7-11', isFinished: true }
    ]
  }
];

module.exports = { users, classes };


