// Project001/models/session.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const sessionSchema = new Schema({
  sessionId: { type: String, required: true, unique: true },
  class: { type: Schema.Types.ObjectId, ref: 'Class' },
  level: { type: Number, required: true, enum: [1, 2, 3] }, // 1, 2, or 3
  // Tự động xóa document sau 2 phút để dọn dẹp
  // MongoDB sẽ kiểm tra trường này định kỳ và xóa document khi hết hạn
  createdAt: { type: Date, expires: '2m', default: Date.now }
});

module.exports = mongoose.model('Session', sessionSchema);
