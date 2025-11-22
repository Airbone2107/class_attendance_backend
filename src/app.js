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
const classRoutes = require('./routes/classRoutes'); // <-- THÊM DÒNG NÀY
const debugRoutes = require('./routes/debugRoutes'); // <-- THÊM DÒNG NÀY

app.use('/api', authRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/classes', classRoutes); // <-- THÊM DÒNG NÀY
app.use('/api/debug', debugRoutes); // <-- THÊM DÒNG NÀY

// Route mặc định
app.get('/', (req, res) => {
  res.send('Welcome to SmartCheck API v2 (MongoDB)');
});

module.exports = app;