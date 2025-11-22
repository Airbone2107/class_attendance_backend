// Project001/models/user.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
  userId: { type: String, required: true, unique: true }, // vd: "sv001" or "gv001"
  password: { type: String, required: true },
  fullName: { type: String, required: true },
  role: { type: String, enum: ['student', 'teacher'], required: true },
  nfcId: { type: String, unique: true, sparse: true }, // Chỉ sinh viên mới có, sparse cho phép nhiều document null
  faceVector: { type: String } // Giả lập vector khuôn mặt
}, { timestamps: true }); // Thêm createdAt và updatedAt tự động

module.exports = mongoose.model('User', userSchema);
