// class_attendance_backend/__tests__/auth.test.js
// Project001/__tests__/auth.test.js
const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/user.model');
const bcrypt = require('bcryptjs');

describe('Auth API: /api/login', () => {

  // Chuẩn bị dữ liệu mẫu trước mỗi test
  beforeEach(async () => {
    const hashedPassword = await bcrypt.hash('password123', 10);
    await User.create({
      userId: 'sv001',
      password: hashedPassword,
      fullName: 'Nguyen Van A',
      role: 'student',
      nfcId: 'NFC12345'
    });
  });

  it('Nên trả về token khi đăng nhập thành công với thông tin hợp lệ', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({
        userId: 'sv001',
        password: 'password123',
      });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.userId).toBe('sv001');
    expect(res.body.user.role).toBe('student');
  });

  it('Nên trả về lỗi 401 khi mật khẩu sai', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({
        userId: 'sv001',
        password: 'wrongpassword',
      });

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('Invalid userId or password.');
  });

  it('Nên trả về lỗi 401 khi userId không tồn tại', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({
        userId: 'nonexistentuser',
        password: 'password123',
      });

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe('Invalid userId or password.');
  });

  it('Nên trả về lỗi 400 khi thiếu userId hoặc password', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({
        userId: 'sv001',
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Please provide userId and password.');
  });
});