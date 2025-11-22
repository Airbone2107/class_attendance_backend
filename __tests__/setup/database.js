const mongoose = require('mongoose');
const { connectDB, disconnectDB, clearDB } = require('../../src/config/db');

// Kết nối tới DB test trước khi tất cả các test bắt đầu
beforeAll(async () => {
  await connectDB();
});

// Dọn dẹp DB sau mỗi test case bằng hàm clearDB chuẩn
afterEach(async () => {
  await clearDB();
});

// Ngắt kết nối khỏi DB sau khi tất cả các test kết thúc
afterAll(async () => {
  await disconnectDB();
});