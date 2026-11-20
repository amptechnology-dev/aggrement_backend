const transporter = require("./emailtransporter");

const sendOtpEmail = async (user, otp) => {
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: user.email,
    subject: "Your login OTP - Agreement Management System",
    html: `<p>Dear ${user.name},</p>
           <p>Your one-time password (OTP) to login is:</p>
           <h2 style="letter-spacing:4px">${otp}</h2>
           <p>This OTP is valid for 10 minutes. Do not share it with anyone.</p>`,
  });
};

const sendWelcomeEmail = async (user, roleLabel) => {
  await transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to: user.email,
    subject: "Your account has been created",
    html: `<p>Dear ${user.name},</p>
           <p>Your <b>${roleLabel}</b> account has been created.</p>
           <p>Login with this email (${user.email}) and the OTP sent to it.</p>`,
  });
};

module.exports = { sendOtpEmail, sendWelcomeEmail };
