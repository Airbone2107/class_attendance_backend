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

// Index mới: Đảm bảo sinh viên chỉ điểm danh 1 lần cho 1 lesson HOẶC 1 exam
attendanceRecordSchema.index({ student: 1, class: 1, lessonId: 1 }, { unique: true, sparse: true });
attendanceRecordSchema.index({ student: 1, exam: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('AttendanceRecord', attendanceRecordSchema);