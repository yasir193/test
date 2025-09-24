import { pool } from "../../../DB/connection.js";
// Add Admin
export const addAdmin = async (req, res) => {
  try {
    const requester = req.admin;

    // Only super admins can add new admins
    if (requester.role !== "super") {
      return res
        .status(403)
        .json({ error: "Only super admins can add new admins" });
    }

    const { name, email, phone, password, role } = req.body;

    // check if email already exists
    const emailCheck = await pool.query(
      "SELECT 1 FROM tbl_admins WHERE email = $1",
      [email]
    );

    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ error: "Email already exists" });
    }

    // insert new admin
    const query = `
      INSERT INTO tbl_admins (name, email, role, password, phone)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING admin_id, name, email, role, phone
    `;
    const values = [name, email, role, password, phone];
    const result = await pool.query(query, values);

    res.json({
      message: "Admin added successfully!",
      data: result.rows[0],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getAllAdmins = async (req, res) => {
  const requester = req.admin;
  try {
    const query = `
      SELECT 
        a.admin_id,
        a.name,
        a.email,
        a.phone,
        a.role
      FROM tbl_admins a
      ORDER BY a.admin_id ASC;
    `;
    const result = await pool.query(query);

    if (result.rowCount === 0) {
      res.status(404).json({ message: "no admins found" });
    }
    res.status(200).json({ data: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Delete User
export const deleteAdmin = async (req, res) => {
  try {
    const { targetId } = req.params; // admin to delete
    const requester = req.admin; // from JWT middleware

    // only super can delete
    if (requester.role !== "super") {
      return res.status(403).json({ error: "Only super admins can delete" });
    }

    // prevent super from deleting themselves
    if (parseInt(targetId) === requester.admin_id) {
      return res.status(400).json({ error: "You cannot delete yourself" });
    }

    // check target
    const target = await pool.query(
      "SELECT admin_id, role FROM tbl_admins WHERE admin_id = $1",
      [targetId]
    );

    if (target.rows.length === 0) {
      return res.status(404).json({ error: "Admin not found" });
    }

    if (target.rows[0].role === "super") {
      return res.status(403).json({ error: "Cannot delete a super admin" });
    }

    await pool.query("DELETE FROM tbl_admins WHERE admin_id = $1", [targetId]);

    res.json({ message: "Admin deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get all pending plan requests
export const getPendingPlanRequests = async (req, res) => {
  try {
    const query = `
      SELECT 
          r.request_id,
          r.user_id,
          u.name AS user_name,
          u.email,
          r.status,
          r.created_at AS request_date
      FROM tbl_plan_requests r
      JOIN tbl_users u ON r.user_id = u.user_id
      WHERE r.status = 'pending'
      ORDER BY r.created_at ASC;
    `;

    const result = await pool.query(query);

    res.status(200).json({
      status: "success",
      data: result.rows,
    });
  } catch (err) {
    console.error("Error fetching plan requests:", err);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch pending requests",
    });
  }
};

// Admin approves a plan change request
export const approvePlanRequest = async (req, res) => {
  const { requestId } = req.params; // request id comes from URL

  try {
    // get request details
    const request = await pool.query(
      `SELECT * FROM tbl_plan_requests WHERE request_id = $1 AND status = 'pending'`,
      [requestId]
    );
    console.log(requestId);
    if (request.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "Request not found or already handled" });
    }

    const { user_id, requested_plan_id } = request.rows[0];

    // update user's plan
    await pool.query(
      "UPDATE tbl_users SET fk_plan_id = $1 WHERE user_id = $2",
      [requested_plan_id, user_id]
    );

    // update request status
    const updatedRequest = await pool.query(
      `UPDATE tbl_plan_requests 
        SET status = 'approved' , decision_date = NOW() 
        WHERE request_id = $1
       RETURNING *`,
      [requestId]
    );

    res.json({
      message: "Plan request approved successfully",
      request: updatedRequest.rows[0],
    });
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ message: "Failed to approve plan request" });
  }
};

// Admin rejects a plan change request
export const rejectPlanRequest = async (req, res) => {
  const { requestId } = req.params;

  try {
    // get request details
    const request = await pool.query(
      "SELECT * FROM tbl_plan_requests WHERE request_id = $1 AND status = 'pending'",
      [requestId]
    );

    if (request.rows.length === 0) {
      return res
        .status(404)
        .json({ message: "Request not found or already handled" });
    }

    // update request status
    const updatedRequest = await pool.query(
      `UPDATE tbl_plan_requests 
        SET status = 'rejected', decision_date = NOW() 
        WHERE request_id = $1
       RETURNING *`,
      [requestId]
    );

    res.json({
      message: "Plan request rejected successfully",
      request: updatedRequest.rows[0],
    });
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ message: "Failed to reject plan request" });
  }
};

export const dashboardStats = async (req, res) => {
  try {
    const [
      totalUsers,
      newUsersThisWeek,
      proUsersCount,
      freeUsersCount,
      pendingRequests,
      weeklyRegistrations,
      monthlyRegistrations,
    ] = await Promise.all([
      pool.query(`SELECT COUNT(user_id) AS count FROM tbl_users`),
      pool.query(
        `SELECT COUNT(*) AS count 
         FROM tbl_users 
         WHERE created_at > NOW() - INTERVAL '7 days'`
      ),
      pool.query(
        `SELECT COUNT(u.user_id) AS count 
         FROM tbl_users u 
         INNER JOIN tbl_plans p ON u.fk_plan_id = p.plan_id 
         WHERE plan_name = 'pro'`
      ),
      pool.query(
        `SELECT COUNT(u.user_id) AS count 
         FROM tbl_users u 
         INNER JOIN tbl_plans p ON u.fk_plan_id = p.plan_id 
         WHERE plan_name = 'free'`
      ),
      pool.query(
        `SELECT COUNT(r.request_id) AS count 
         FROM tbl_plan_requests r 
         WHERE status = 'pending'`
      ),
      // ✅ Weekly Registrations (current week)
      pool.query(`
        SELECT 
          TO_CHAR(created_at, 'Dy') AS day,
          COUNT(*) AS count
        FROM tbl_users
        WHERE created_at >= date_trunc('week', CURRENT_DATE)
        GROUP BY day
        ORDER BY MIN(created_at)
      `),
      // ✅ Monthly Registrations (current year)
      pool.query(`
        SELECT 
          TO_CHAR(created_at, 'Mon') AS month,
          EXTRACT(MONTH FROM created_at) AS month_number,
          COUNT(*) AS count
        FROM tbl_users
        WHERE created_at >= date_trunc('year', CURRENT_DATE)
        GROUP BY month, month_number
        ORDER BY month_number
      `),
    ]);

    // Days in order
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const weeklyCounts = days.map((day) => {
      const row = weeklyRegistrations.rows.find((r) => r.day === day);
      return row ? Number(row.count) : 0;
    });

    // Months in order
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlyCounts = months.map((month) => {
      const row = monthlyRegistrations.rows.find((r) => r.month === month);
      return row ? Number(row.count) : 0;
    });

    const stats = {
      totalUsers: Number(totalUsers.rows[0].count),
      newUsersThisWeek: Number(newUsersThisWeek.rows[0].count),
      proUsersCount: Number(proUsersCount.rows[0].count),
      freeUsersCount: Number(freeUsersCount.rows[0].count),
      pendingRequests: Number(pendingRequests.rows[0].count),
      weeklyRegistrations: {
        labels: ["S", "M", "T", "W", "T", "F", "S"],
        datasets: {
          label: "Weekly Registrations",
          data: weeklyCounts,
        },
      },
      monthlyRegistrations: {
        labels: months,
        datasets: {
          label: "Monthly Registrations",
          data: monthlyCounts,
        },
      },
    };

    res.json(stats);
  } catch (err) {
    console.error("Dashboard Stats Error:", err);
    res.status(500).json({ error: "Failed to fetch dashboard stats" });
  }
};



