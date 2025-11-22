const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const lessonSchema = new Schema({
  lessonId: { type: String, required: true }, // VD: L1, L2
  date: { type: Date, required: true },
  room: { type: String, required: true }, // VD: E1-09.08
  shift: { type: String, required: true }, // VD: "7-11"
  topic: { type: String }, // Tên bài học (nếu có)
  isFinished: { type: Boolean, default: false }
});

const classSchema = new Schema({
  classId: { type: String, required: true, unique: true }, // VD: MAN104
  className: { type: String, required: true }, // VD: Quản lý dự án CNTT
  credits: { type: Number, required: true }, // Số tín chỉ
  group: { type: String, required: true }, // Nhóm/Tổ
  teacher: { type: Schema.Types.ObjectId, ref: 'User' },
  students: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  lessons: [lessonSchema] // Danh sách các buổi học cụ thể
}, { timestamps: true });

module.exports = mongoose.model('Class', classSchema);
