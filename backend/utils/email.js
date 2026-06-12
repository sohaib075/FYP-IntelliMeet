const nodemailer = require('nodemailer');
const config = require('../config/environment');

/**
 * ============================================================
 * Email Utility
 * ============================================================
 * Sends emails using Nodemailer.
 * In development, it prints the OTP to the console.
 * ============================================================
 */

// Create a reusable transporter object using SMTP transport
// For production, you would configure this with a real SMTP service
// (e.g., SendGrid, Mailgun, Amazon SES).
// For now, it just mocks it or uses Ethereal if configured.
const createTransporter = async () => {
  console.log("=== EMAIL CONFIGURATION CHECK ===");
  console.log("SMTP_HOST:", process.env.SMTP_HOST);
  console.log("SMTP_USER:", process.env.SMTP_USER);
  console.log("=================================");

  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_PORT === '465', 
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Try to verify, if it fails, throw an error instead of silently falling back
    try {
      await transporter.verify();
      console.log("✅ SMTP connection verified in createTransporter");
      return transporter;
    } catch (err) {
      console.error("❌ SMTP connection failed in createTransporter:", err.message);
      throw new Error("Failed to connect to SMTP server: " + err.message);
    }
  }

  // If no SMTP credentials are provided, throw an error (Do not use mock mode)
  throw new Error("Missing SMTP_HOST or SMTP_USER in environment variables. Email verification requires a real SMTP server.");
};

/**
 * Send an OTP email to a user
 * @param {string} to - The recipient's email address
 * @param {string} otp - The 6-digit OTP code
 */
const sendOtpEmail = async (to, otp) => {
  const transporter = await createTransporter();

  const mailOptions = {
    from: `"IntelliMeet Security" <${process.env.SMTP_USER}>`,
    replyTo: process.env.SMTP_USER,
    to,
    subject: 'Your IntelliMeet Verification Code',
    headers: {
      'X-Entity-Ref-ID': otp, // Unique reference
      'X-Priority': '1 (Highest)',
    },
    text: `Welcome to IntelliMeet!\n\nYour 6-digit verification code is: ${otp}\n\nThis code will expire in 10 minutes.\nIf you did not request this, please ignore this email.`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>IntelliMeet Verification</title>
        <style>
          @media (prefers-color-scheme: dark) {
            .bg-main { background-color: #121212 !important; }
            .bg-card { background-color: #1a1a1a !important; border-color: #333333 !important; }
            .text-primary { color: #e5e5e5 !important; }
            .text-secondary { color: #a3a3a3 !important; }
            .bg-otp { background-color: #262626 !important; }
          }
        </style>
      </head>
      <body class="bg-main" style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" class="bg-main" style="background-color: #f8fafc; padding: 40px 15px;">
          <tr>
            <td align="center">
              <table width="100%" max-width="500" border="0" cellspacing="0" cellpadding="0" class="bg-card" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 500px; width: 100%; margin: 0 auto;">
                <tr>
                  <td style="padding: 24px;">
                    <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #3b82f6;">IntelliMeet Verification</h2>
                    
                    <p class="text-primary" style="margin: 0 0 24px 0; font-size: 15px; line-height: 22px; color: #1e293b;">
                      Welcome to IntelliMeet! To complete your registration, please enter the following verification code:
                    </p>
                    
                    <div class="bg-otp" style="background-color: #f1f5f9; border-radius: 6px; padding: 20px 10px; text-align: center; margin-bottom: 24px;">
                      <span class="text-primary" style="font-family: monospace; font-size: 28px; font-weight: 700; letter-spacing: 14px; color: #0f172a; padding-left: 14px;">${otp}</span>
                    </div>

                    <p class="text-secondary" style="margin: 0; font-size: 13px; line-height: 20px; color: #64748b;">
                      This code will expire in 10 minutes. If you did not request this, please ignore this email.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `
  };

  await transporter.sendMail(mailOptions);
};

/**
 * Send a password reset email to a user
 * @param {string} to - The recipient's email address
 * @param {string} resetUrl - The full URL containing the reset token
 */
const sendPasswordResetEmail = async (to, resetUrl) => {
  const transporter = await createTransporter();

  const mailOptions = {
    from: `"IntelliMeet Security" <${process.env.SMTP_USER}>`,
    replyTo: process.env.SMTP_USER,
    to,
    subject: 'IntelliMeet Password Reset Request',
    headers: {
      'X-Priority': '1 (Highest)',
    },
    text: `You requested a password reset.\n\nPlease click on the following link, or paste this into your browser to complete the process:\n\n${resetUrl}\n\nIf you did not request this, please ignore this email and your password will remain unchanged.`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>IntelliMeet Password Reset</title>
        <style>
          @media (prefers-color-scheme: dark) {
            .bg-main { background-color: #121212 !important; }
            .bg-card { background-color: #1a1a1a !important; border-color: #333333 !important; }
            .text-primary { color: #e5e5e5 !important; }
            .text-secondary { color: #a3a3a3 !important; }
          }
        </style>
      </head>
      <body class="bg-main" style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" class="bg-main" style="background-color: #f8fafc; padding: 40px 15px;">
          <tr>
            <td align="center">
              <table width="100%" max-width="500" border="0" cellspacing="0" cellpadding="0" class="bg-card" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 500px; width: 100%; margin: 0 auto;">
                <tr>
                  <td style="padding: 24px;">
                    <h2 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 600; color: #3b82f6;">IntelliMeet Password Reset</h2>
                    
                    <p class="text-primary" style="margin: 0 0 24px 0; font-size: 15px; line-height: 22px; color: #1e293b;">
                      You recently requested to reset your password for your IntelliMeet account. Click the button below to proceed:
                    </p>
                    
                    <div style="text-align: center; margin: 32px 0;">
                      <a href="${resetUrl}" style="background-color: #3b82f6; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; display: inline-block;">Reset Password</a>
                    </div>

                    <p class="text-secondary" style="margin: 0; font-size: 13px; line-height: 20px; color: #64748b;">
                      This link will expire in 15 minutes. If you did not request this, please ignore this email.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `
  };

  await transporter.sendMail(mailOptions);
};

module.exports = {
  sendOtpEmail,
  sendPasswordResetEmail
};
