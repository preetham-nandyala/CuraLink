const jwt = require('jsonwebtoken');
const User = require('../models/User');
const axios = require('axios');
const OtpVerification = require('../models/OtpVerification');
const crypto = require('crypto');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'secret123', { expiresIn: '30d' });
};

exports.registerUser = async (req, res) => {
  const { name, email, password, otp } = req.body;
  try {
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: 'User already exists' });

    if (!otp) return res.status(400).json({ message: 'OTP verification is required for registration' });

    // Verify OTP
    const record = await OtpVerification.findOne({ email, otp, verified: false });
    if (!record) return res.status(400).json({ message: 'Invalid OTP' });
    if (record.expiresAt < new Date()) return res.status(400).json({ message: 'OTP has expired' });

    // Mark as verified
    record.verified = true;
    await record.save();

    const user = await User.create({ name, email, password });
    if (user) {
      res.status(201).json({ _id: user.id, name: user.name, email: user.email, token: generateToken(user._id) });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.loginUser = async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (user && (await user.matchPassword(password))) {
      res.json({ _id: user.id, name: user.name, email: user.email, token: generateToken(user._id) });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Generate 6 digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

exports.sendOtp = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email is required' });

  try {
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: 'User already exists. Please login instead.' });

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Clear previous unverified OTPs for this email to prevent spam
    await OtpVerification.deleteMany({ email });

    await OtpVerification.create({
      email,
      otp,
      expiresAt
    });

    // Send email via Brevo
    console.log(`\n📧 [DEV MODE] OTP generated for ${email}: ${otp}`);
    
    if (!process.env.BREVO_API_KEY) {
      console.warn('   ⚠️ BREVO_API_KEY not configured. Simulating success.');
    } else {
      try {
        await axios.post('https://api.brevo.com/v3/smtp/email', {
          sender: { email: process.env.BREVO_SENDER_EMAIL || 'noreply@curalink.com', name: 'Curalink AI' },
          to: [{ email }],
          subject: 'Your Login OTP',
          htmlContent: `<p>Your OTP is <strong>${otp}</strong>. It is valid for 5 minutes.</p>`
        }, {
          headers: {
            'api-key': process.env.BREVO_API_KEY,
            'Content-Type': 'application/json'
          }
        });
        console.log('   ✅ Brevo API: Email dispatched successfully.');
      } catch (brevoErr) {
        const errorData = brevoErr.response?.data;
        console.error('   ❌ BREVO API REJECTION ❌');
        console.error(JSON.stringify(errorData || brevoErr.message, null, 2));
        
        // Return the REAL error to the user so they can fix settings
        return res.status(400).json({ 
          message: errorData?.message || 'Brevo API rejected the request.' 
        });
      }
    }

    res.status(200).json({ message: 'OTP sent successfully' });
  } catch (error) {
    console.error('   🔥 Critical Controller Error:', error);
    res.status(500).json({ message: 'Internal server error during OTP send' });
  }
};

exports.verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ message: 'Email and OTP are required' });

  try {
    const record = await OtpVerification.findOne({ email, otp, verified: false });

    if (!record) {
      return res.status(400).json({ message: 'Invalid OTP' });
    }

    if (record.expiresAt < new Date()) {
      return res.status(400).json({ message: 'OTP has expired' });
    }

    // Mark as verified
    record.verified = true;
    await record.save();

    // Check if user exists or create new one (Passwordless)
    let user = await User.findOne({ email });
    if (!user) {
      // Use email prefix as temporary name, leave password blank or secure random
      user = await User.create({ 
        name: email.split('@')[0], 
        email, 
        password: crypto.randomBytes(32).toString('hex') 
      });
    }

    res.status(200).json({
      _id: user.id,
      name: user.name,
      email: user.email,
      token: generateToken(user._id)
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email is required' });

  try {
    const userExists = await User.findOne({ email });
    if (!userExists) return res.status(404).json({ message: 'No account found with that email' });

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await OtpVerification.deleteMany({ email });
    await OtpVerification.create({ email, otp, expiresAt });

    console.log(`\n🔑 [DEV MODE] Reset Password OTP for ${email}: ${otp}`);

    if (!process.env.BREVO_API_KEY) {
      console.warn('   ⚠️ BREVO_API_KEY not configured. Simulating success.');
    } else {
      try {
        await axios.post('https://api.brevo.com/v3/smtp/email', {
          sender: { email: process.env.BREVO_SENDER_EMAIL || 'noreply@curalink.com', name: 'Curalink AI' },
          to: [{ email }],
          subject: 'Password Reset OTP',
          htmlContent: `<p>Your password reset code is <strong>${otp}</strong>. It is valid for 5 minutes.</p>`
        }, {
          headers: {
            'api-key': process.env.BREVO_API_KEY,
            'Content-Type': 'application/json'
          }
        });
        console.log('   ✅ Brevo API: Reset email dispatched.');
      } catch (brevoErr) {
        const errorData = brevoErr.response?.data;
        console.error('   ❌ BREVO API REJECTION ❌');
        console.error(JSON.stringify(errorData || brevoErr.message, null, 2));

        return res.status(400).json({ 
          message: errorData?.message || 'Brevo API rejected the password reset.' 
        });
      }
    }
    res.status(200).json({ message: 'Password reset code sent' });
  } catch (error) {
    console.error('   🔥 Critical Reset Error:', error);
    res.status(500).json({ message: 'Internal server error during reset send' });
  }
};

exports.resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) return res.status(400).json({ message: 'Missing required fields' });

  try {
    const record = await OtpVerification.findOne({ email, otp, verified: false });
    if (!record) return res.status(400).json({ message: 'Invalid OTP' });
    if (record.expiresAt < new Date()) return res.status(400).json({ message: 'OTP has expired' });

    record.verified = true;
    await record.save();

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.password = newPassword;
    await user.save(); // Mongoose pre-save hook handles hashing

    res.status(200).json({ message: 'Password successfully updated' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

