const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const sessionSchema = new Schema({
  sessionId: { type: String, required: true, unique: true },
  class: { type: Schema.Types.ObjectId, ref: 'Class' },
  lessonId: { type: String, required: true }, // Quan trọng: Phiên này thuộc buổi học nào
  level: { type: Number, required: true, enum: [1, 2, 3] },
  active: { type: Boolean, default: true },
  // Tự động xóa document sau 5 phút
  createdAt: { type: Date, expires: '5m', default: Date.now }
});

module.exports = mongoose.model('Session', sessionSchema);
