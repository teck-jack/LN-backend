const mongoose = require('mongoose');
const constants = require('../utils/constants');

const CaseSchema = new mongoose.Schema({
  caseId: {
    type: String,
    required: true,
    unique: true
  },
  endUserId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  serviceId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Service',
    required: true
  },
  employeeId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    default: null
  },
  status: {
    type: String,
    enum: Object.values(constants.CASE_STATUS),
    default: constants.CASE_STATUS.NEW
  },
  currentStep: {
    type: Number,
    default: 0
  },
  documents: [{
    name: {
      type: String,
      required: true
    },
    url: {
      type: String,
      required: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    uploadedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true
    }
  }],
  notes: [{
    text: {
      type: String,
      required: true
    },
    createdBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  assignedAt: {
    type: Date,
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for service details
CaseSchema.virtual('service', {
  ref: 'Service',
  localField: 'serviceId',
  foreignField: '_id',
  justOne: true
});

// Virtual for end user details
CaseSchema.virtual('endUser', {
  ref: 'User',
  localField: 'endUserId',
  foreignField: '_id',
  justOne: true
});

// Virtual for employee details
CaseSchema.virtual('employee', {
  ref: 'User',
  localField: 'employeeId',
  foreignField: '_id',
  justOne: true
});

module.exports = mongoose.model('Case', CaseSchema);