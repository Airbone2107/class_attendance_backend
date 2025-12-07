const express = require('express');
const cors = require('cors');

// --- Khởi tạo Express App ---
const app = express();

// --- Cấu hình Middleware ---
app.use(cors());
app.use(express.json());

// --- Định nghĩa Routes ---
const authRoutes = require('./routes/authRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const classRoutes = require('./routes/classRoutes');
const examRoutes = require('./routes/examRoutes'); // <-- MỚI
const debugRoutes = require('./routes/debugRoutes');

app.use('/api', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/exams', examRoutes); // <-- MỚI
app.use('/api/debug', debugRoutes);

// Route mặc định
app.get('/', (req, res) => {
  res.send('Welcome to SmartCheck API v2 (MongoDB) with Exam Module');
});

module.exports = app;