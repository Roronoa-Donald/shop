const fp = require('fastify-plugin');
const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');

async function mailerPlugin(fastify) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 465,
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  async function sendEmail(templateName, to, subject, data) {
    try {
      const htmlTemplate = await fs.readFile(
        path.join(__dirname, '../templates', `${templateName}.html`),
        'utf-8'
      );
      const textTemplate = await fs.readFile(
        path.join(__dirname, '../templates', `${templateName}.txt`),
        'utf-8'
      );

      let html = htmlTemplate;
      let text = textTemplate;

      // Simple template replacement
      Object.keys(data).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        html = html.replace(regex, data[key]);
        text = text.replace(regex, data[key]);
      });

      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to,
        subject,
        html,
        text
      };

      await transporter.sendMail(mailOptions);
      return true;
    } catch (error) {
      fastify.log.error('Email sending failed:', error);
      return false;
    }
  }

  fastify.decorate('sendEmail', sendEmail);
}

module.exports = fp(mailerPlugin);