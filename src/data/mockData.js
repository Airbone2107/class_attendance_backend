const mongoose = require('mongoose');

// ID Cố định
const teacherId = new mongoose.Types.ObjectId('654321654321654321654321');
const studentId = new mongoose.Types.ObjectId('123456123456123456123456');

// Dữ liệu thẻ NFC giả lập
const mockNfcIds = [
  "730F6013",
  "A35247E3",
  "B3503FE3",
  '04ADDA40C22A81', 
  '04B21643C22A81',
  '04A96740C22A81',
  '04D9B241C22A81',
  '04689842C22A81'
];

const users = [
  {
    _id: teacherId,
    userId: 'gv001',
    password: 'password123',
    fullName: 'Giảng Viên Demo',
    role: 'teacher'
  },
  {
    _id: studentId,
    userId: 'sv001', 
    password: 'password123',
    fullName: 'Nguyễn Văn A',
    role: 'student',
    nfcId: mockNfcIds[0],
    faceVector: 'mock_face_data'
  },
  ...mockNfcIds.slice(1).map((nfcId, index) => ({
    userId: `sv0${index + 2}`,
    password: 'password123',
    fullName: `Sinh Viên Test ${index + 2}`,
    role: 'student',
    nfcId,
    faceVector: 'mock_face_data'
  }))
];

const getStartOfCurrentWeek = () => {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
};

const generateLessons = (dayOfWeekIso, startHour, room, shift) => {
  const lessons = [];
  const startOfWeek = getStartOfCurrentWeek();
  const dayOffset = dayOfWeekIso - 1;

  for (let i = -4; i <= 4; i++) {
    const lessonDate = new Date(startOfWeek);
    lessonDate.setDate(lessonDate.getDate() + (i * 7) + dayOffset);
    lessonDate.setHours(startHour, 0, 0, 0);
    const isFinished = i < 0;

    lessons.push({
      lessonId: `L${i + 5}`, 
      date: lessonDate,
      room: room,
      shift: shift,
      isFinished: isFinished
    });
  }
  return lessons;
};

const classes = [
  {
    classId: 'MAN104',
    className: 'Quản lý dự án công nghệ thông tin',
    credits: 3,
    group: '13',
    teacher: teacherId,
    students: [studentId],
    lessons: generateLessons(1, 7, 'E1-09.08', '7-11')
  },
  {
    classId: 'COS141',
    className: 'Phát triển ứng dụng với J2EE',
    credits: 3,
    group: '01',
    teacher: teacherId,
    students: [studentId],
    lessons: generateLessons(2, 12, 'E1-09.05', '2-6') 
  },
  {
    classId: 'CAP126',
    className: 'Ngôn ngữ phát triển ứng dụng mới',
    credits: 3,
    group: '01',
    teacher: teacherId,
    students: [studentId],
    lessons: generateLessons(3, 7, 'B1-10.01', '7-11')
  }
];

// --- MOCK EXAMS (MỚI) ---
const exams = [
    {
        examId: 'EX_COS141',
        name: 'Thi Cuối Kỳ: Phát triển ứng dụng với J2EE',
        // Set ngày thi là Thứ 6 tuần này, 9h sáng
        date: (() => {
            const d = getStartOfCurrentWeek();
            d.setDate(d.getDate() + 4); // Friday
            d.setHours(9, 0, 0, 0);
            return d;
        })(),
        room: 'E3-05.01',
        supervisor: teacherId,
        students: [studentId], // SV này được phép thi
        isFinished: false
    },
    {
        examId: 'EX_MAN104',
        name: 'Thi Giữa Kỳ: Quản lý dự án CNTT',
        // Set ngày thi là Thứ 7 tuần này, 13h30 chiều
        date: (() => {
            const d = getStartOfCurrentWeek();
            d.setDate(d.getDate() + 5); // Saturday
            d.setHours(13, 30, 0, 0);
            return d;
        })(),
        room: 'B1-10.02',
        supervisor: teacherId,
        students: [studentId],
        isFinished: false
    }
];

module.exports = { users, classes, exams };