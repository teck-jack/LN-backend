const mongoose = require('mongoose');
const constants = require('../utils/constants');

const NotificationSchema = new mongoose.Schema({
  recipientId: {
    type: mongoose.Schema.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: Object.values(constants.NOTIFICATION_TYPES),
    required: true
  },
  title: {
    type: String,
    required: [true, 'Please add a notification title']
  },
  message: {
    type: String,
    required: [true, 'Please add a notification message']
  },
  isRead: {
    type: Boolean,
    default: false
  },
  relatedCaseId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Case',
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Notification', NotificationSchema);