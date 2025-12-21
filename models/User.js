const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const constants = require('../utils/constants');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a name'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      'Please add a valid email'
    ]
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: 6,
    select: false
  },
  phone: {
    type: String,
    required: [true, 'Please add a phone number']
  },
  role: {
    type: String,
    enum: Object.values(constants.USER_ROLES),
    required: [true, 'Please specify a role']
  },
  sourceTag: {
    type: String,
    enum: Object.values(constants.SOURCE_TAGS),
    default: constants.SOURCE_TAGS.SELF
  },
  agentId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  profilePicture: {
    type: String,
    default: ''
  },
  assignedModules: [{
    type: String,
    enum: Object.values(constants.SERVICE_TYPES)
  }],
  resetPasswordToken: String,
  resetPasswordExpire: Date,
  createdAt: {
    type: Date,
    default: Date.now
  },
  // 🆕 NEW FIELDS FOR SRS
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: {
    type: String,
    select: false // Don't include in queries by default
  },
  loginActivity: [{
    timestamp: {
      type: Date,
      required: true
    },
    ipAddress: {
      type: String
    },
    userAgent: {
      type: String
    },
    deviceType: {
      type: String,
      enum: ['desktop', 'mobile', 'tablet', 'unknown'],
      default: 'unknown'
    },
    location: {
      type: String
    },
    status: {
      type: String,
      enum: ['success', 'failed'],
      default: 'success'
    }
  }],
  sessionTokens: [{
    token: {
      type: String,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    expiresAt: {
      type: Date,
      required: true
    },
    deviceInfo: {
      type: String
    }
  }],
  skills: [{
    type: String,
    trim: true
  }], // For employees - skill-based assignment
  performanceScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  }, // For agents
  commissionRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  }, // For agents - percentage
  totalCommissionEarned: {
    type: Number,
    default: 0
  } // For agents
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Encrypt password using bcrypt
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Sign JWT and return
UserSchema.methods.getSignedJwtToken = function () {
  return jwt.sign({ id: this._id }, config.jwtSecret, {
    expiresIn: config.jwtExpire
  });
};

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Method to add login activity
UserSchema.methods.addLoginActivity = async function (activityData) {
  this.loginActivity.unshift(activityData);
  // Keep only last 50 login activities
  if (this.loginActivity.length > 50) {
    this.loginActivity = this.loginActivity.slice(0, 50);
  }
  await this.save();
};

// Method to clean expired sessions
UserSchema.methods.cleanExpiredSessions = async function () {
  const now = new Date();
  this.sessionTokens = this.sessionTokens.filter(session => session.expiresAt > now);
  await this.save();
};

// Virtual for cases if user is an end user
UserSchema.virtual('cases', {
  ref: 'Case',
  localField: '_id',
  foreignField: 'endUserId',
  justOne: false
});

// Virtual for assigned cases if user is an employee
UserSchema.virtual('assignedCases', {
  ref: 'Case',
  localField: '_id',
  foreignField: 'employeeId',
  justOne: false
});

// Virtual for onboarded users if user is an agent
UserSchema.virtual('onboardedUsers', {
  ref: 'User',
  localField: '_id',
  foreignField: 'agentId',
  justOne: false
});

module.exports = mongoose.model('User', UserSchema);