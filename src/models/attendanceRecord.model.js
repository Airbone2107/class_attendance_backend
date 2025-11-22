const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const attendanceRecordSchema = new Schema({
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  class: { type: Schema.Types.ObjectId, ref: 'Class', required: true },
  session: { type: Schema.Types.ObjectId, ref: 'Session' }, // Có thể null nếu điểm danh bù
  lessonId: { type: String, required: true }, // Lưu ID của buổi học (VD: L1, L2)
  status: { type: String, enum: ['present', 'late', 'absent'], default: 'present' },
  method: { type: String, enum: ['qr', 'nfc', 'face'], default: 'qr' },
  checkInTime: { type: Date, default: Date.now }
}, { timestamps: true });

// Đảm bảo 1 sinh viên chỉ có 1 bản ghi cho 1 buổi học
attendanceRecordSchema.index({ student: 1, class: 1, lessonId: 1 }, { unique: true });

module.exports = mongoose.model('AttendanceRecord', attendanceRecordSchema);

