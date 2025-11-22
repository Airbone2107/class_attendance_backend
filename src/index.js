// Project001/index.js
const app = require('./app'); // Import app từ file app.js
const { connectDB } = require('./config/db');

// --- Kết nối Database ---
connectDB();

const PORT = process.env.PORT || 3000;

// --- Khởi động Server ---
const server = app.listen(PORT, () => {
  // Không log ra console khi chạy ở môi trường test để giữ output sạch sẽ
  if (process.env.NODE_ENV !== 'test') {
    console.log(`Server is running on http://localhost:${PORT}`);
  }
});

module.exports = server; // Export server để có thể đóng nó trong test