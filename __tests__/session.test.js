// class_attendance_backend/__tests__/session.test.js
// Project001/__tests__/session.test.js
const request = require('supertest');
const app = require('../src/app');
const User = require('../src/models/user.model');
const Class = require('../src/models/class.model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

describe('Session API: /api/sessions/create', () => {
  let teacherToken;
  let studentToken;
  let testClass;

  beforeEach(async () => {
    // Tạo user giảng viên và sinh viên
    const hashedPassword = await bcrypt.hash('password123', 10);
    const teacher = await User.create({
      userId: 'gv001',
      password: hashedPassword,
      fullName: 'Tran Thi B',
      role: 'teacher'
    });
    const student = await User.create({
        userId: 'sv001',
        password: hashedPassword,
        fullName: 'Nguyen Van A',
        role: 'student',
        nfcId: 'NFC12345'
      });

    // Tạo lớp học với danh sách lessons (CẬP NHẬT)
    testClass = await Class.create({
        classId: 'IT101',
        className: 'Nhap mon Cong nghe phan mem',
        teacher: teacher._id,
        credits: 3,
        group: '01',
        lessons: [
            {
                lessonId: 'L1',
                date: new Date(),
                room: 'A101',
                shift: '1-3',
                isFinished: false
            }
        ]
    });

    // Tạo token
    teacherToken = jwt.sign({ id: teacher._id, role: teacher.role }, process.env.JWT_SECRET);
    studentToken = jwt.sign({ id: student._id, role: student.role }, process.env.JWT_SECRET);
  });
  
  it('Nên tạo session thành công khi giảng viên hợp lệ gửi request (kèm lessonId)', async () => {
    const res = await request(app)
        .post('/api/sessions/create')
        .set('Authorization', `Bearer ${teacherToken}` )
        .send({
            classId: 'IT101',
            lessonId: 'L1', // CẬP NHẬT: Thêm lessonId
            level: 1
        });
    
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('sessionId');
    expect(res.body.level).toBe(1);
  });

  it('Nên trả về lỗi 403 khi sinh viên cố gắng tạo session', async () => {
    const res = await request(app)
        .post('/api/sessions/create')
        .set('Authorization', `Bearer ${studentToken}` )
        .send({
            classId: 'IT101',
            lessonId: 'L1',
            level: 1
        });
    
    expect(res.statusCode).toBe(403);
  });
  
  it('Nên trả về lỗi 401 khi không có token', async () => {
    const res = await request(app)
        .post('/api/sessions/create')
        .send({
            classId: 'IT101',
            lessonId: 'L1',
            level: 1
        });
    
    expect(res.statusCode).toBe(401);
  });

  it('Nên trả về lỗi 404 khi classId không tồn tại', async () => {
    const res = await request(app)
        .post('/api/sessions/create')
        .set('Authorization', `Bearer ${teacherToken}` )
        .send({
            classId: 'NONEXISTENT_CLASS',
            lessonId: 'L1',
            level: 1
        });
    
    expect(res.statusCode).toBe(404);
  });

  it('Nên trả về lỗi 404 khi lessonId không tồn tại trong lớp', async () => {
    const res = await request(app)
        .post('/api/sessions/create')
        .set('Authorization', `Bearer ${teacherToken}` )
        .send({
            classId: 'IT101',
            lessonId: 'WRONG_LESSON',
            level: 1
        });
    
    expect(res.statusCode).toBe(404);
    expect(res.body.error).toContain('not found in class');
  });
});