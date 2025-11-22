// Project001/jest.config.js
module.exports = {
  testEnvironment: 'node',
  // Chỉ định rõ ràng các file test cần chạy
  testMatch: ['**/__tests__/**/*.test.js'],
  // Chạy file này trước khi chạy các file test
  setupFilesAfterEnv: ['./__tests__/setup/database.js'],
  // Bỏ qua thư mục node_modules khi tìm kiếm file test
  testPathIgnorePatterns: ['/node_modules/'],
  // Cấu hình reporter để xuất ra file HTML và file text tùy chỉnh
  reporters: [
    'default', // Giữ lại reporter mặc định trên console
    [
      'jest-html-reporters',
      {
        publicPath: './html-report',
        filename: 'report.html',
        expand: true,
      },
    ],
    './text-reporter.js', // <-- THÊM DÒNG NÀY
  ],
};