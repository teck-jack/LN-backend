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
  },
  // 🆕 NEW FIELDS FOR SRS
  invoiceNumber: {
    type: String,
    unique: true,
    sparse: true // Allows null values
  },
  invoiceUrl: {
    type: String,
    trim: true
  },
  receiptUrl: {
    type: String,
    trim: true
  },
  invoiceGeneratedAt: {
    type: Date
  },
  receiptGeneratedAt: {
    type: Date
  }
});

// Generate invoice number before saving
PaymentSchema.pre('save', async function (next) {
  if (this.isNew && !this.invoiceNumber) {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const count = await this.constructor.countDocuments();
    this.invoiceNumber = `INV-${year}${month}-${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

module.exports = mongoose.model('Payment', PaymentSchema);