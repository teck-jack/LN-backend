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
  },
  // 🆕 NEW FIELDS FOR SRS
  workflowTemplateId: {
    type: mongoose.Schema.ObjectId,
    ref: 'WorkflowTemplate',
    default: null
  },
  checklistProgress: [{
    stepId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    isCompleted: {
      type: Boolean,
      default: false
    },
    completedAt: {
      type: Date
    },
    completedBy: {
      type: mongoose.Schema.ObjectId,
      ref: 'User'
    }
  }],
  slaDeadline: {
    type: Date,
    default: null
  },
  slaStatus: {
    type: String,
    enum: ['on_time', 'at_risk', 'breached', 'not_set'],
    default: 'not_set'
  },
  complexityTag: {
    type: String,
    enum: ['simple', 'medium', 'complex'],
    default: 'medium'
  },
  estimatedResolutionTime: {
    type: String, // Human-readable format like "3-5 business days"
    default: null
  },
  reopenCount: {
    type: Number,
    default: 0
  },
  lastActivityAt: {
    type: Date,
    default: Date.now
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
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

// Virtual for workflow template
CaseSchema.virtual('workflowTemplate', {
  ref: 'WorkflowTemplate',
  localField: 'workflowTemplateId',
  foreignField: '_id',
  justOne: true
});

// Method to update last activity timestamp
CaseSchema.methods.updateActivity = function () {
  this.lastActivityAt = new Date();
  return this.save();
};

// Method to calculate SLA status
CaseSchema.methods.calculateSLAStatus = function () {
  if (!this.slaDeadline) {
    this.slaStatus = 'not_set';
    return this.slaStatus;
  }

  const now = new Date();
  const deadline = new Date(this.slaDeadline);
  const hoursRemaining = (deadline - now) / (1000 * 60 * 60);

  if (now > deadline) {
    this.slaStatus = 'breached';
  } else if (hoursRemaining <= 24) {
    this.slaStatus = 'at_risk';
  } else {
    this.slaStatus = 'on_time';
  }

  return this.slaStatus;
};

module.exports = mongoose.model('Case', CaseSchema);