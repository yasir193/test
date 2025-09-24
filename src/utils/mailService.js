import nodemailer from "nodemailer";
import { EventEmitter } from "node:events";

export const SendEmailService = async ({
  to,
  subject,
  html,
  attachments = [],
}) => {
  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
      tls:{
        rejectUnauthorized:false
      }
    });

    const info = await transporter.sendMail({
      from: `"NO-REPLY" <${process.env.EMAIL_USER}>`, // sender address
      to, // list of receivers
      subject, // Subject line
      html, // html body
      attachments,
    });

    return info;
  } catch (error) {
    console.log("Error from sending email", error);
    return error;
  }
};

export const emitter = new EventEmitter();

emitter.on("sendEmail", (...args) => {
  console.log(args);
  const {to , email , subject , html , attachments} = args[0]
  SendEmailService({
    to,
    subject,
    html,
    attachments,
  });
  console.log('email sent');
  
});