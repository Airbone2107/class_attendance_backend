const Exam = require('../models/exam.model');

// @desc    Lấy danh sách lịch thi của sinh viên
// @route   GET /api/exams/student
const getStudentExams = async (req, res) => {
    if (req.user.role !== 'student') {
        return res.status(403).json({ error: 'Chỉ sinh viên mới có lịch thi.' });
    }
    try {
        // Tìm các bài thi có sinh viên này trong danh sách
        const exams = await Exam.find({ students: req.user._id }).sort({ date: 1 });
        
        // Map data trả về format dễ dùng
        const result = exams.map(e => ({
            examId: e.examId,
            name: e.name,
            date: e.date,
            room: e.room,
            isFinished: e.isFinished
        }));

        res.status(200).json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Lỗi lấy lịch thi.' });
    }
};

// @desc    Lấy danh sách buổi thi do giáo viên coi thi
// @route   GET /api/exams/teacher
const getTeacherExams = async (req, res) => {
    if (req.user.role !== 'teacher') {
        return res.status(403).json({ error: 'Chỉ giáo viên mới xem được danh sách coi thi.' });
    }
    try {
        const exams = await Exam.find({ supervisor: req.user._id }).sort({ date: 1 });
        res.status(200).json(exams);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Lỗi lấy danh sách coi thi.' });
    }
};

module.exports = { getStudentExams, getTeacherExams };