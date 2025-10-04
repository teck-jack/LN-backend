const express = require('express');
const {
  register,
  login,
  getMe,
  forgotPassword,
  resetPassword,
  updateDetails,
  updatePassword,
  logout
} = require('../controllers/authController');

// Import the authentication middleware
const { protect } = require('../middleware/auth'); // Assuming auth.js is in ../middleware

const router = express.Router();

router.post('/register', register);
router.post('/login', login);

// ADDED: The 'protect' middleware ensures req.user is populated before getMe runs.
router.get('/me', protect, getMe); 

router.post('/forgotpassword', forgotPassword);
router.put('/resetpassword/:resettoken', resetPassword);

// ADDED: Protect these routes as well
router.put('/updatedetails', protect, updateDetails);
router.put('/updatepassword', protect, updatePassword);
router.get('/logout', protect, logout);

module.exports = router;
