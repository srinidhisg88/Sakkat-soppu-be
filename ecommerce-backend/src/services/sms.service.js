let twilioClient = null;
try {
  const twilio = require('twilio');
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (accountSid && authToken) twilioClient = twilio(accountSid, authToken);
} catch (err) {
  // twilio might not be installed in some environments; we'll handle gracefully
  twilioClient = null;
}

const sendSmsToAdmin = async (to, message) => {
  if (!twilioClient) {
    throw new Error('Twilio client not configured');
  }
  const from = process.env.TWILIO_FROM;
  if (!from) throw new Error('TWILIO_FROM not set');

  return await twilioClient.messages.create({ body: message, from, to });
};

module.exports = {
  sendSmsToAdmin,
};
