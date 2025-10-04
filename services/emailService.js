const nodemailer = require('nodemailer');
const config = require('../config/config');

const sendEmail = async (options) => {
  // Create a transporter
  const transporter = nodemailer.createTransport({
    host: config.emailHost,
    port: config.emailPort,
    secure: false, // true for 465, false for other ports
    auth: {
      user: config.emailUser,
      pass: config.emailPass
    }
  });

  // Define email options
  const mailOptions = {
    from: `${config.emailUser}`,
    to: options.email,
    subject: options.subject,
    text: options.message,
    html: options.html
  };

  // Send the email
  await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;