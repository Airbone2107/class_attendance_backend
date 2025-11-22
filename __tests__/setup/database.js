// class_attendance_backend/__tests__/setup/database.js
// Project001/__tests__/setup/database.js
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../../src/config/db');
const server = require('../../src/index'); // Import server để đóng sau khi test

// Kết nối tới DB test trước khi tất cả các test bắt đầu
beforeAll(async () => {
  await connectDB();
});

// Dọn dẹp DB sau mỗi test case
// THAY ĐỔI: Sử dụng dropDatabase() để đảm bảo dọn dẹp triệt để
afterEach(async () => {
  if (mongoose.connection.db) {
    // Lấy danh sách tất cả các collection
    const collections = await mongoose.connection.db.collections();
    // Xóa toàn bộ dữ liệu của từng collection
    for (let collection of collections) {
      await collection.deleteMany({});
    }
  }
});


// Ngắt kết nối khỏi DB và đóng server sau khi tất cả các test kết thúc
afterAll(async () => {
  await disconnectDB();
  server.close(); // Đóng server để giải phóng port và open handles
});