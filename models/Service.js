const mongoose = require('mongoose');
const constants = require('../utils/constants');

const ServiceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a service name'],
    trim: true
  },
  type: {
    type: String,
    enum: Object.values(constants.SERVICE_TYPES),
    required: [true, 'Please specify a service type']
  },
  description: {
    type: String,
    required: [true, 'Please add a service description']
  },
  price: {
    type: Number,
    required: [true, 'Please add a service price']
  },
  duration: {
    type: String,
    required: [true, 'Please add estimated duration']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  documentsRequired: [{
    type: String
  }],
  processSteps: [{
    stepNumber: {
      type: Number,
      required: true
    },
    title: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  // 🆕 NEW FIELDS FOR SRS
  defaultWorkflowTemplateId: {
    type: mongoose.Schema.ObjectId,
    ref: 'WorkflowTemplate',
    default: null
  }
});

// Virtual for default workflow template
ServiceSchema.virtual('defaultWorkflowTemplate', {
  ref: 'WorkflowTemplate',
  localField: 'defaultWorkflowTemplateId',
  foreignField: '_id',
  justOne: true
});

module.exports = mongoose.model('Service', ServiceSchema);