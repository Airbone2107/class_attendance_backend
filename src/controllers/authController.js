// Project001/controllers/authController.js
const User = require('../models/user.model');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// @desc    Đăng nhập người dùng & lấy token
// @route   POST /api/login
// @access  Public
const loginUser = async (req, res) => {
  const { userId, password } = req.body;

  if (!userId || !password) {
    return res.status(400).json({ error: 'Please provide userId and password.' });
  }

  try {
    // 1. Tìm người dùng bằng userId
    const user = await User.findOne({ userId });

    // 2. Nếu không có user hoặc mật khẩu không khớp, báo lỗi
    // (Sử dụng bcrypt.compare để so sánh mật khẩu đã hash)
    if (user && (await bcrypt.compare(password, user.password))) {
      // 3. Tạo JWT
      const token = jwt.sign(
        { id: user._id, role: user.role }, // Payload
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
      );

      // 4. Trả về thông tin cần thiết
      res.status(200).json({
        message: 'Login successful!',
        token,
        user: {
          id: user._id,
          userId: user.userId,
          fullName: user.fullName,
          role: user.role,
        },
      });
    } else {
      res.status(401).json({ error: 'Invalid userId or password.' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login.' });
  }
};

module.exports = { loginUser };
