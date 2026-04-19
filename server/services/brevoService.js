const axios = require('axios');

class BrevoService {
  constructor() {
    this.apiKey = process.env.BREVO_API_KEY;
    this.senderEmail = process.env.BREVO_SENDER_EMAIL;
    this.apiUrl = 'https://api.brevo.com/v3/smtp/email';
  }

  async sendOtpEmail(toEmail, toName, otp) {
    if (!this.apiKey) {
      console.warn('⚠️ No Brevo API Key found. Skipping email send. OTP is:', otp);
      return { success: true }; // Pretend it works for local testing
    }

    try {
      await axios.post(
        this.apiUrl,
        {
          sender: { name: 'CuraLink', email: this.senderEmail },
          to: [{ email: toEmail, name: toName }],
          subject: 'Your CuraLink Verification Code',
          htmlContent: `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
              <h2 style="color: #0F6E56;">CuraLink Verification</h2>
              <p>Hello ${toName},</p>
              <p>Use the following OTP code to complete your verification:</p>
              <div style="background-color: #f4f4f5; padding: 15px; border-radius: 8px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
                ${otp}
              </div>
              <p>This code will expire in 10 minutes.</p>
              <p>If you did not request this, please ignore this email.</p>
            </div>
          `,
        },
        {
          headers: {
            'api-key': this.apiKey,
            'Content-Type': 'application/json',
          },
        }
      );
      return { success: true };
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      console.error('Brevo Email Error:', errorMsg);
      return { success: false, error: errorMsg };
    }
  }
}

module.exports = new BrevoService();
