// class_attendance_backend/src/controllers/userController.js
const User = require('../models/user.model');

// @desc    Đăng ký/Cập nhật khuôn mặt cho user
// @route   POST /api/users/register-face
const registerFace = async (req, res) => {
  const { faceEmbedding } = req.body;

  if (!faceEmbedding || !Array.isArray(faceEmbedding) || faceEmbedding.length === 0) {
    return res.status(400).json({ error: 'Invalid face embedding data.' });
  }

  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    user.faceEmbedding = faceEmbedding;
    await user.save();

    res.status(200).json({ message: 'Face registered successfully!' });
  } catch (error) {
    console.error('Error registering face:', error);
    res.status(500).json({ error: 'Server error.' });
  }
};

module.exports = { registerFace };

