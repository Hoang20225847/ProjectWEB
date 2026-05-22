const nodemailer = require('nodemailer');

function createTransporter() {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || 'false').toLowerCase() === 'true';
  const user = process.env.SMTP_USER || '';
  const pass = process.env.SMTP_PASS || '';

  if (!user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

async function sendResetPasswordLink({ toEmail, resetLink }) {
  const transporter = createTransporter();
  if (!transporter) {
    console.warn(`[mail] Missing SMTP config, skip sending reset link to ${toEmail}. Link: ${resetLink}`);
    return { sent: false };
  }

  const from = process.env.MAIL_FROM || process.env.SMTP_USER;
  await transporter.sendMail({
    from,
    to: toEmail,
    subject: 'BookStore - Link đặt lại mật khẩu',
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5">
        <h2>Đặt lại mật khẩu</h2>
        <p>Bạn vừa yêu cầu đặt lại mật khẩu cho tài khoản BookStore.</p>
        <p>Hãy bấm vào link bên dưới để đặt lại mật khẩu (hiệu lực 10 phút):</p>
        <p><a href="${resetLink}" target="_blank" rel="noopener noreferrer">${resetLink}</a></p>
        <p>Nếu bạn không yêu cầu, vui lòng bỏ qua email này.</p>
      </div>
    `,
  });

  return { sent: true };
}

module.exports = {
  sendResetPasswordLink,
};
