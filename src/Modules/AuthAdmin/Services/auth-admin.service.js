import { pool } from "../../../DB/connection.js";
import jwt from "jsonwebtoken";

export const adminSignIn = async (req, res) => {
  try {
    const { email, password } = req.body;

    // find admin
    const result = await pool.query(
      "SELECT * FROM tbl_admins WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const admin = result.rows[0];

    if (password !== admin.password) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    // generate JWT
    const accesstoken = jwt.sign(
      { admin_id: admin.admin_id, email: admin.email, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({
      message: "Admin login successful",
      accesstoken,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
