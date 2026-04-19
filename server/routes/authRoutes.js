const express = require('express');
const router = express.Router();
const { registerUser, loginUser, getMe, sendRegisterOtp, sendForgotPasswordOtp, resetPassword } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register/send-otp', sendRegisterOtp);
router.post('/register', registerUser); // Actually verifies OTP and creates user
router.post('/login', loginUser);
router.post('/forgot-password/send-otp', sendForgotPasswordOtp);
router.post('/forgot-password/reset', resetPassword);

router.get('/me', protect, getMe);

module.exports = router;
