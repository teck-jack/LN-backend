const twilio = require('twilio');
const config = require('../config/config');

const client = twilio(config.twilioAccountSid, config.twilioAuthToken);

const sendSMS = async (options) => {
  try {
    const message = await client.messages.create({
      body: options.message,
      from: config.twilioPhoneNumber,
      to: options.phone
    });
    
    return message;
  } catch (error) {
    console.error('Error sending SMS:', error);
    throw error;
  }
};

module.exports = sendSMS;