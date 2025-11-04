const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// Generate JWT Token
const generateToken = (userId) => {
  return jwt.sign(
    { userId }, 
    process.env.JWT_SECRET || 'your-secret-key',
    { expiresIn: '7d' }
  );
};

// Register User
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    console.log(`\n${'='.repeat(50)}`);
    console.log('👤 USER REGISTRATION ATTEMPT');
    console.log(`${'='.repeat(50)}`);
    console.log(`📧 Email: ${email}`);
    console.log(`👤 Name: ${name}`);

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log('❌ User already exists');
      return res.status(400).json({
        success: false,
        error: 'User already exists with this email'
      });
    }

    // Create new user
    const user = new User({
      name,
      email,
      password
    });

    await user.save();

    // Generate token
    const token = generateToken(user._id);

    // Update last login
    await user.updateLastLogin();

    console.log('✅ User registered successfully');
    console.log(`🆔 User ID: ${user._id}`);
    console.log(`${'='.repeat(50)}\n`);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('❌ Registration error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Login User
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log(`\n${'='.repeat(50)}`);
    console.log('🔐 USER LOGIN ATTEMPT');
    console.log(`${'='.repeat(50)}`);
    console.log(`📧 Email: ${email}`);

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      console.log('❌ User not found');
      return res.status(400).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      console.log('❌ Invalid password');
      return res.status(400).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    
    if (!user.isActive) {
      console.log('❌ Account deactivated');
      return res.status(400).json({
        success: false,
        error: 'Account is deactivated'
      });
    }

   
    const token = generateToken(user._id);

    
    await user.updateLastLogin();

    console.log('✅ Login successful');
    console.log(`🆔 User ID: ${user._id}`);
    console.log(`👤 Name: ${user.name}`);
    console.log(`${'='.repeat(50)}\n`);

    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }
    });

  } catch (error) {
    console.error('❌ Login error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


router.get('/me', auth, async (req, res) => {
  try {
    res.json({
      success: true,
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        createdAt: req.user.createdAt,
        lastLogin: req.user.lastLogin
      }
    });
  } catch (error) {
    console.error('Get user error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


router.put('/profile', auth, async (req, res) => {
  try {
    const { name } = req.body;

    const user = await User.findById(req.user._id);
    user.name = name || user.name;

    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt
      }
    });

  } catch (error) {
    console.error('Update profile error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});


router.put('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id);

    
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;