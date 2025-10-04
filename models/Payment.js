const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  caseId: {
    type: mongoose.Schema.ObjectId,
    ref: 'Case',
    required: true
  },
  amount: {
    type: Number,
    required: [true, 'Please add an amount']
  },
  transactionId: {
    type: String,
    required: [true, 'Please add a transaction ID'],
    unique: true
  },
  paymentMethod: {
    type: String,
    required: [true, 'Please add a payment method']
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  paymentDate: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Payment', PaymentSchema);