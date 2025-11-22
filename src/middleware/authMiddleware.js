// Project001/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // 1. Lấy token từ header
      token = req.headers.authorization.split(' ')[1];

      // 2. Xác thực token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // 3. Lấy thông tin người dùng từ DB (không bao gồm password) và gán vào req.user
      // Điều này đảm bảo thông tin user luôn mới nhất
      req.user = await User.findById(decoded.id).select('-password');
      
      if (!req.user) {
        return res.status(401).json({ error: 'User not found.' });
      }

      next(); // Đi tiếp đến controller
    } catch (error) {
      console.error('Token verification failed:', error);
      res.status(401).json({ error: 'Not authorized, token failed.' });
    }
  }

  if (!token) {
    res.status(401).json({ error: 'Not authorized, no token.' });
  }
};

module.exports = { protect };
