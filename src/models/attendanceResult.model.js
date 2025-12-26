const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const attendanceResultSchema = new Schema({
  student: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  
  // Dành cho lớp học
  class: { type: Schema.Types.ObjectId, ref: 'Class' },
  lessonId: { type: String },

  // Dành cho thi
  exam: { type: Schema.Types.ObjectId, ref: 'Exam' },

  // Trạng thái cuối cùng của buổi học đó
  status: { type: String, enum: ['present', 'absent', 'late'], default: 'present' },
  
  // Lưu lần check-in đầu tiên và cuối cùng để tham chiếu
  firstCheckIn: { type: Date, default: Date.now },
  lastCheckIn: { type: Date, default: Date.now },
  
  // Đếm số lần check-in thành công trong buổi học (qua các session khác nhau)
  checkInCount: { type: Number, default: 1 }
}, { timestamps: true });

// Đánh index unique để đảm bảo mỗi SV chỉ có 1 kết quả duy nhất cho 1 buổi học/thi
attendanceResultSchema.index(
    { student: 1, class: 1, lessonId: 1 }, 
    { unique: true, partialFilterExpression: { class: { $exists: true } } }
);

attendanceResultSchema.index(
    { student: 1, exam: 1 }, 
    { unique: true, partialFilterExpression: { exam: { $exists: true } } }
);

module.exports = mongoose.model('AttendanceResult', attendanceResultSchema);