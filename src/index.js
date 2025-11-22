const app = require('./app');
const { connectDB } = require('./config/db');

const PORT = process.env.PORT || 3000;

let server;

// Chỉ kết nối DB và start Server khi file này được chạy trực tiếp
if (require.main === module) {
  connectDB();

  server = app.listen(PORT, () => {
    if (process.env.NODE_ENV !== 'test') {
      console.log(`Server is running on http://localhost:${PORT}`);
    }
  });
}

module.exports = server;