const mongoose = require('mongoose');

const checklistItemSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  isOptional: {
    type: Boolean,
    default: false
  },
  order: {
    type: Number,
    required: true
  }
}, { _id: true });

const workflowStepSchema = new mongoose.Schema({
  stepName: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  order: {
    type: Number,
    required: true
  },
  estimatedDuration: {
    type: Number, // in hours
    default: 24
  },
  checklistItems: [checklistItemSchema],
  requiredDocuments: [{
    type: String,
    trim: true
  }]
}, { _id: true });

const workflowTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Template name is required'],
    trim: true,
    unique: true
  },
  description: {
    type: String,
    trim: true
  },
  serviceType: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: [true, 'Service type is required']
  },
  steps: [workflowStepSchema],
  totalEstimatedDuration: {
    type: Number, // in hours, calculated from steps
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  metadata: {
    version: {
      type: String,
      default: '1.0'
    },
    tags: [{
      type: String,
      trim: true
    }],
    complexity: {
      type: String,
      enum: ['simple', 'medium', 'complex'],
      default: 'medium'
    }
  }
}, {
  timestamps: true
});

// Calculate total estimated duration before saving
workflowTemplateSchema.pre('save', function(next) {
  if (this.steps && this.steps.length > 0) {
    this.totalEstimatedDuration = this.steps.reduce((total, step) => {
      return total + (step.estimatedDuration || 0);
    }, 0);
  }
  next();
});

// Index for faster queries
workflowTemplateSchema.index({ serviceType: 1, isActive: 1 });
workflowTemplateSchema.index({ createdBy: 1 });

module.exports = mongoose.model('WorkflowTemplate', workflowTemplateSchema);
