const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const attendanceRecordSchema = new Schema({
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  
  // Link tới Session đã tạo record này
  session: { type: Schema.Types.ObjectId, ref: 'Session' }, 

  // Trường hợp 1: Điểm danh lớp học
  class: { type: Schema.Types.ObjectId, ref: 'Class' },
  lessonId: { type: String }, 

  // Trường hợp 2: Điểm danh thi (Mới)
  exam: { type: Schema.Types.ObjectId, ref: 'Exam' },

  status: { type: String, enum: ['present', 'late', 'absent'], default: 'present' },
  method: { type: String, enum: ['qr', 'nfc', 'face', 'qr_face', 'nfc_loc'], default: 'qr' },
  checkInTime: { type: Date, default: Date.now }
}, { timestamps: true });

// CẬP NHẬT: Sử dụng partialFilterExpression để tránh lỗi duplicate key khi trường đó là null
// Index cũ (sparse: true) vẫn đánh index nếu có field student, dẫn đến trùng lặp (student + null)

// 1. Đảm bảo sinh viên chỉ điểm danh 1 lần cho 1 lesson (Chỉ khi có class)
attendanceRecordSchema.index(
    { student: 1, class: 1, lessonId: 1 }, 
    { unique: true, partialFilterExpression: { class: { $exists: true } } }
);

// 2. Đảm bảo sinh viên chỉ điểm danh 1 lần cho 1 exam (Chỉ khi có exam)
attendanceRecordSchema.index(
    { student: 1, exam: 1 }, 
    { unique: true, partialFilterExpression: { exam: { $exists: true } } }
);

module.exports = mongoose.model('AttendanceRecord', attendanceRecordSchema);