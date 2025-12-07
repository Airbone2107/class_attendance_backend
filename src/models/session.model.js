const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const sessionSchema = new Schema({
  sessionId: { type: String, required: true, unique: true },
  type: { type: String, enum: ['class', 'exam'], default: 'class' }, // Loại phiên
  
  // Dành cho lớp học
  class: { type: Schema.Types.ObjectId, ref: 'Class' },
  lessonId: { type: String }, 

  // Dành cho buổi thi (Mới)
  exam: { type: Schema.Types.ObjectId, ref: 'Exam' },

  level: { type: Number, required: true, enum: [1, 2, 3] },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, expires: '5m', default: Date.now }
});

module.exports = mongoose.model('Session', sessionSchema);