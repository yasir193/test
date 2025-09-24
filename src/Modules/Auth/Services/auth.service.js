import { pool } from "../../../DB/connection.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import CryptoJS from "crypto-js";
import crypto from "crypto";
import { SendEmailService } from "../../../utils/mailService.js";
import { OAuth2Client } from "google-auth-library";
import { v4 as uuidv4 } from "uuid";

export const signUp = async (req, res) => {
  try {
    const {
      name,
      email,
      job_title,
      typeOfUser,
      business_name,
      business_sector,
      password,
      confirmPassword,
      phone,
    } = req.validatedData;

    if (password !== confirmPassword) {
      return res
        .status(400)
        .json({ message: "Password and Confirm Password doesn't match" });
    }

    // check if email exists
    const emailCheck = await pool.query(
      "SELECT 1 FROM tbl_users WHERE email = $1",
      [email]
    );
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ error: "Email already exists" });
    }

    // hash password
    const hashedPassword = bcrypt.hashSync(password, +process.env.SALT);

    // encrypt phone
    const encryptedPhone = CryptoJS.AES.encrypt(
      phone,
      process.env.CRYPTO_SECRET
    ).toString();

    // insert user
    const query = `
      INSERT INTO tbl_users 
        (name, email, job_title, typeOfUser, business_name, business_sector, password, phone)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING user_id, name, email, job_title, typeOfUser, business_name, business_sector, phone
    `;
    const values = [
      name,
      email,
      job_title,
      typeOfUser,
      business_name,
      business_sector,
      hashedPassword,
      encryptedPhone,
    ];

    const result = await pool.query(query, values);

    const user = result.rows[0];

    res.status(201).json({
      message: "User registered successfully!",
      user,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const signIn = async (req, res) => {
  try {
    const { email, password } = req.body;

    // find user with plan name
    const result = await pool.query(
      `SELECT u.user_id, u.email, u.password ,u.fk_plan_id, p.plan_name
       FROM tbl_users u
       LEFT JOIN tbl_plans p ON u.fk_plan_id = p.plan_id
       WHERE u.email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const user = result.rows[0];

    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    // include plan_name in the token
    const accesstoken = jwt.sign(
      {
        name: user.name,
        user_id: user.user_id,
        email: user.email,
        plan: user.plan_name,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      message: "Login successful",
      accesstoken,
    });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ error: err.message });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // 1. check if user exists
    const userCheck = await pool.query(
      "SELECT user_id, email FROM tbl_users WHERE email = $1",
      [email]
    );

    if (userCheck.rows.length === 0) {
      return res.status(400).json({ error: "User not found" });
    }

    // 2. generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // 3. expiry (5 min from now)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // 4. update DB with OTP + expiry
    await pool.query(
      "UPDATE tbl_users SET reset_otp = $1, reset_otp_expiry = $2 WHERE email = $3",
      [otp, expiresAt, email]
    );

    // 5. send email
    await SendEmailService({
      to: email,
      subject: "Password Reset - OTP Code",
      html: `
        <p>Hello,</p>
        <p>Your OTP code is: <b>${otp}</b></p>
        <p>This code will expire in 5 minutes.</p>
      `,
    });

    res.json({ message: "OTP sent to your email" });
  } catch (err) {
    console.error("Forgot Password Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    // 1. fetch OTP and expiry from DB
    const result = await pool.query(
      "SELECT reset_otp, reset_otp_expiry FROM tbl_users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: "User not found" });
    }

    const { reset_otp, reset_otp_expiry } = result.rows[0];

    // 2. check if OTP matches
    if (otp !== reset_otp) {
      return res.status(400).json({ error: "Invalid OTP" });
    }

    // 3. check expiry
    if (new Date() > reset_otp_expiry) {
      return res.status(400).json({ error: "OTP expired" });
    }

    // 4. hash new password
    const saltRounds = parseInt(process.env.SALT) || 10;
    const hashedPassword = bcrypt.hashSync(newPassword, saltRounds);

    // 5. update password + clear OTP
    await pool.query(
      "UPDATE tbl_users SET password = $1, reset_otp = NULL, reset_otp_expiry = NULL WHERE email = $2",
      [hashedPassword, email]
    );

    res.json({ message: "Password reset successfully" });
  } catch (err) {
    console.error("Reset Password Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const GmailLoginService = async (req, res) => {
  try {
    const { idToken } = req.body;

    // 1. Verify Google token
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.WEB_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    const { email_verified, email } = payload;

    if (!email_verified) {
      return res.status(400).json({ message: "Email not verified" });
    }

    // 2. Check if user exists with provider = google
    const result = await pool.query(
      `SELECT u.user_id, u.username, u.email, u.provider, u.fk_plan_id, p.plan_name
        FROM tbl_users u
        LEFT JOIN tbl_plans p ON u.fk_plan_id = p.plan_id
        WHERE u.email = $1 AND u.provider = $2`,
      [email, "google"]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "User not found. Please register first with Gmail.",
      });
    }

    const user = result.rows[0];

    
    const accessToken = jwt.sign(
      {
        user_id: user.user_id,
        email: user.email,
        plan: user.plan_name || "free",
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    return res.status(200).json({
      message: "Login successful",
      user,
      accessToken,
    });
  } catch (err) {
    console.error("Google Login Error:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};


export const GmailRegistrationService = async (req, res) => {
  try {
    const { idToken } = req.body;

    
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.WEB_CLIENT_ID,
    });
    const payload = ticket.getPayload();

    const { email_verified, email, name } = payload;

    if (!email_verified) {
      return res.status(400).json({ message: "Email not verified" });
    }

    
    const userCheck = await pool.query(
      `SELECT u.user_id, u.name, u.email, u.provider, u.fk_plan_id, p.plan_name
        FROM tbl_users u
        LEFT JOIN tbl_plans p ON u.fk_plan_id = p.plan_id
        WHERE u.email = $1 AND u.provider = $2`,
      [email, "google"]
    );

    let user;
    if (userCheck.rows.length > 0) {
      user = userCheck.rows[0];
    } else {
      
      const saltRounds = parseInt(process.env.SALT) || 10;
      const randomPassword = bcrypt.hashSync(uuidv4(), saltRounds);

      const newUser = await pool.query(
        `INSERT INTO tbl_users (name, email, provider, password) 
          VALUES ($1, $2, $3, $4)
          RETURNING user_id, name, email, provider, fk_plan_id`,
        [name, email, "google", randomPassword]
      );

      
      const createdUser = newUser.rows[0];
      const planResult = await pool.query(
        `SELECT plan_name FROM tbl_plans WHERE plan_id = $1`,
        [createdUser.fk_plan_id]
      );

      user = {
        ...createdUser,
        plan_name: planResult.rows[0]?.plan_name || "free",
      };
    }

    
    const accessToken = jwt.sign(
      {
        user_id: user.user_id,
        email: user.email,
        plan: user.plan_name,
      },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    return res.status(200).json({
      message: userCheck.rows.length > 0 ? "User already exists" : "User created successfully",
      user,
      accessToken,
    });
  } catch (err) {
    console.error("Google Auth Error:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

