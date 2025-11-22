// Project001/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { loginUser } = require('../controllers/authController');
const { registerFace } = require('../controllers/userController'); // <-- Import mới
const { protect } = require('../middleware/authMiddleware');

router.post('/login', loginUser);
// Route mới để đăng ký khuôn mặt, cần đăng nhập trước
router.post('/users/register-face', protect, registerFace); 

module.exports = router;
