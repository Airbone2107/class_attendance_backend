// class_attendance_backend/__tests__/attendance.test.js
// Project001/__tests__/attendance.test.js
const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/user.model');
const Class = require('../src/models/class.model');
const Session = require('../src/models/session.model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

describe('Attendance API: /api/attendance/check-in', () => {
  let studentToken, teacherToken, testClass, testSession;

  beforeEach(async () => {
    const hashedPassword = await bcrypt.hash('password123', 10);
    const student = await User.create({ userId: 'sv001', password: hashedPassword, fullName: 'Student A', role: 'student', nfcId: 'NFC123' });
    const teacher = await User.create({ userId: 'gv001', password: hashedPassword, fullName: 'Teacher B', role: 'teacher' });

    testClass = await Class.create({ classId: 'CS101', className: 'Test Class', teacher: teacher._id });
    testSession = await Session.create({ sessionId: 'ABCD', class: testClass._id, level: 2 });
    
    studentToken = jwt.sign({ id: student._id, role: student.role }, process.env.JWT_SECRET);
    teacherToken = jwt.sign({ id: teacher._id, role: teacher.role }, process.env.JWT_SECRET);
  });

  it('Điểm danh thành công cho Level 2 với đầy đủ thông tin', async () => {
    const res = await request(app)
      .post('/api/attendance/check-in')
      .set('Authorization', `Bearer ${studentToken}` )
      .send({
        sessionId: 'ABCD',
        nfcCardId: 'NFC123',
        faceVector: 'mock-face-vector'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toBe('Check-in successful!');
  });
  
  it('Trả về lỗi 400 nếu NFC ID không khớp', async () => {
    const res = await request(app)
      .post('/api/attendance/check-in')
      .set('Authorization', `Bearer ${studentToken}` )
      .send({
        sessionId: 'ABCD',
        nfcCardId: 'WRONG_NFC',
        faceVector: 'mock-face-vector'
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('NFC Card ID does not match.');
  });
  
  it('Trả về lỗi 400 cho Level 2 nếu thiếu faceVector', async () => {
    const res = await request(app)
      .post('/api/attendance/check-in')
      .set('Authorization', `Bearer ${studentToken}` )
      .send({
        sessionId: 'ABCD',
        nfcCardId: 'NFC123',
      });

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Face vector is required for this level.');
  });

  it('Trả về lỗi 404 nếu sessionId không tồn tại', async () => {
     const res = await request(app)
      .post('/api/attendance/check-in')
      .set('Authorization', `Bearer ${studentToken}` )
      .send({
        sessionId: 'NONEXISTENT',
        nfcCardId: 'NFC123',
        faceVector: 'mock-face-vector'
      });
      
      expect(res.statusCode).toBe(404);
  });
});