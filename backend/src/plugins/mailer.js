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

      // Template replacement with HTML escaping
      Object.keys(data).forEach(key => {
        const regex = new RegExp(`{{${key}}}`, 'g');
        const value = String(data[key] ?? '');
        const escaped = value
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
        html = html.replace(regex, escaped);
        text = text.replace(regex, value);
      });

      const mailOptions = {
        from: process.env.EMAIL_FROM,
        to,
        subject,
        html,
        text
      };

      console.log('Sending email to:', to, 'subject:', subject);
      const result = await transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', result.messageId);
      return true;
    } catch (error) {
      console.error('Email sending failed:', error.message);
      fastify.log.error('Email sending failed:', error);
      throw error; // Remonter l'erreur pour la gérer
    }
  }

  fastify.decorate('sendEmail', sendEmail);
}

module.exports = fp(mailerPlugin);