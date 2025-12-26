const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Model này bây giờ đóng vai trò là "LOG CHI TIẾT" (Attendance Log)
// Lưu lại sự kiện sinh viên đã tham gia vào một SESSION cụ thể
const attendanceRecordSchema = new Schema({
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  session: { type: Schema.Types.ObjectId, ref: 'Session', required: true }, 

  // Các trường tham chiếu để dễ query, nhưng logic chính dựa vào session
  class: { type: Schema.Types.ObjectId, ref: 'Class' },
  lessonId: { type: String }, 
  exam: { type: Schema.Types.ObjectId, ref: 'Exam' },

  status: { type: String, enum: ['present', 'late', 'absent'], default: 'present' },
  method: { type: String, enum: ['qr', 'nfc', 'face', 'qr_face', 'nfc_loc'], default: 'qr' },
  checkInTime: { type: Date, default: Date.now }
}, { timestamps: true });

// QUAN TRỌNG: Chỉ đảm bảo mỗi SV chỉ check-in 1 lần TRONG 1 SESSION
// Bỏ index unique theo lessonId để cho phép check-in nhiều lần (tăng cường) trong cùng 1 buổi học
attendanceRecordSchema.index({ student: 1, session: 1 }, { unique: true });

module.exports = mongoose.model('AttendanceRecord', attendanceRecordSchema);