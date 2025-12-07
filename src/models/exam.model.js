const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const examSchema = new Schema({
  examId: { type: String, required: true, unique: true }, // VD: EXAM_MOB101
  name: { type: String, required: true }, // VD: Thi Cuối Kỳ Mobile
  date: { type: Date, required: true },
  room: { type: String, required: true },
  supervisor: { type: Schema.Types.ObjectId, ref: 'User', required: true }, // Giám thị (Giáo viên)
  students: [{ type: Schema.Types.ObjectId, ref: 'User' }], // Danh sách sinh viên được thi
  isFinished: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Exam', examSchema);