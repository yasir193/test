import CryptoJS from "crypto-js";
import { pool } from "../../../DB/connection.js";




export const getProfile = async (req, res) => {
  try {
    const userID = req.user.user_id;
    
    // 1. Get user profile data
    const profileQuery = `
      SELECT name, phone, plan_name, job_title, email, typeOfUser, business_name, business_sector, created_at,
             p.plan_id, p.number_of_uploads, p.refine_requests, p.analysis_requests
      FROM tbl_users u
      INNER JOIN tbl_plans p ON u.fk_plan_id = p.plan_id 
      WHERE u.user_id = $1
    `;
    const profileResult = await pool.query(profileQuery, [userID]);

    if (profileResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const profile = profileResult.rows[0];
    const { phone, plan_id, number_of_uploads, refine_requests, analysis_requests, ...userWithoutPhone } = profile;

    // Decrypt phone number
    let decryptedPhone = null;
    if (phone) {
      decryptedPhone = CryptoJS.AES.decrypt(phone, process.env.CRYPTO_SECRET)
        .toString(CryptoJS.enc.Utf8);
    }

    // 2. Get user's current usage
    const usageQuery = `
      SELECT 
        COALESCE(number_of_uploads, 0) AS uploads_used,
        COALESCE(refine_requests, 0) AS refines_used,
        COALESCE(analysis_requests, 0) AS analysis_used
      FROM tbl_user_plan_usage
      WHERE user_id = $1
      ORDER BY updated_at DESC
      LIMIT 1
    `;

    const usageResult = await pool.query(usageQuery, [userID]);
    const usage = usageResult.rows[0] || {
      uploads_used: 0,
      refines_used: 0,
      analysis_used: 0,
    };

    // 3. Get total files uploaded (projects created)
    const filesQuery = `
      SELECT COUNT(*) AS total_files
      FROM tbl_files
      WHERE user_id = $1
    `;

    const filesResult = await pool.query(filesQuery, [userID]);
    const totalFiles = parseInt(filesResult.rows[0].total_files, 10);

    // 4. Calculate credits usage
    const totalAllowed = number_of_uploads + refine_requests + analysis_requests;
    const totalUsed = usage.uploads_used + usage.refines_used + usage.analysis_used;
    const usagePercentage = totalAllowed > 0 ? Math.round((totalUsed / totalAllowed) * 100) : 0;
    const uploadsPercentage = number_of_uploads > 0 ? Math.round((usage.uploads_used / number_of_uploads) * 100) : 0;

    // 5. Combine profile data with credits usage
    const profileData = {
      ...userWithoutPhone,
      phone: decryptedPhone,
      credits: {
        credits_used: `${totalUsed}/${totalAllowed}`,
        credits_percentage: `${usagePercentage}%`,
        files_uploaded: `${usage.uploads_used}/${number_of_uploads}`,
        projects_created: totalFiles,
      }
    };

    res.status(200).json({
      message: 'Profile and credits data fetched successfully',
      data: profileData
    });
  } catch (error) {
    console.error("getProfile error:", error);
    res.status(500).json({ 
      message: 'Failed to fetch profile data',
      details: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
};