const mongoose = require('mongoose');

// Tạo ID cố định để các quan hệ (relationship) không bị gãy khi reset
const teacherId = new mongoose.Types.ObjectId('654321654321654321654321');
const classId1 = 'IT001';
const classId2 = 'IT002';

// 5 Thẻ NFC giả lập (Giữ 5 thẻ còn lại làm backup)
// HÃY THAY THẾ CÁC CHUỖI NÀY BẰNG ID THẺ THẬT (HEX STRING) CỦA BẠN
const mockNfcIds = [
  '04ADDA40C22A81',
  '04B21643C22A81',
  '04A96740C22A81',
  '04D9B241C22A81',
  '04689842C22A81'
];

const users = [
  // Giảng viên
  {
    _id: teacherId,
    userId: 'gv001',
    password: 'password123', // Sẽ được hash trong controller
    fullName: 'Giảng Viên Demo',
    role: 'teacher'
  },
  // 5 Sinh viên
  ...mockNfcIds.map((nfcId, index) => ({
    userId: `sv0${index + 1}`, // sv01 -> sv05
    password: 'password123',
    fullName: `Sinh Viên Test ${index + 1}`,
    role: 'student',
    nfcId, // ID thẻ NFC
    faceVector: 'mock_face_vector_data'
  }))
];

const classes = [
  {
    classId: classId1,
    className: 'Lập trình Di động (Flutter)',
    teacher: teacherId,
    // Gán tất cả sinh viên vào lớp này để test cho dễ
    students: [] // Sẽ được điền ID sinh viên trong controller
  },
  {
    classId: classId2,
    className: 'Kiểm thử Phần mềm',
    teacher: teacherId,
    students: []
  }
];

module.exports = { users, classes };


