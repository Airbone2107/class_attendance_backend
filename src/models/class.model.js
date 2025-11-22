// Project001/models/class.model.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const classSchema = new Schema({
  classId: { type: String, required: true, unique: true }, // vd: "it101"
  className: { type: String, required: true },
  teacher: { type: Schema.Types.ObjectId, ref: 'User' },
  students: [{ type: Schema.Types.ObjectId, ref: 'User' }]
}, { timestamps: true });

module.exports = mongoose.model('Class', classSchema);
