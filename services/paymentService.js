const Razorpay = require('razorpay');
const config = require('../config/config');

const razorpay = new Razorpay({
  key_id: config.razorpayKeyId,
  key_secret: config.razorpayKeySecret
});

const createOrder = async (amount, testMode = false) => {
  try {
    if (testMode) {
      return {
        id: `order_test_${Date.now()}`,
        amount: amount * 100,
        currency: 'INR',
        status: 'created',
        test_mode: true
      };
    }

    const options = {
      amount: amount * 100, // Razorpay expects amount in paise
      currency: 'INR',
      receipt: `receipt_${Date.now()}`
    };

    const order = await razorpay.orders.create(options);
    return order;
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    throw error;
  }
};

const verifyPayment = async (paymentDetails, testMode = false) => {
  try {
    if (testMode) {
      return true;
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = paymentDetails;

    const generated_signature = crypto.createHmac('sha256', config.razorpayKeySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    return generated_signature === razorpay_signature;
  } catch (error) {
    console.error('Error verifying payment:', error);
    throw error;
  }
};

module.exports = {
  createOrder,
  verifyPayment
};