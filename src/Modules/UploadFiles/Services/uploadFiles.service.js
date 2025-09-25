import { pool } from "../../../DB/connection.js";

export const uploadFile = async (req, res) => {
  const { jsonData, fileName, summary, overview, recommendations } = req.body;
  const userId = req.user.user_id;

  try {
    if (!fileName) {
      return res.status(400).json({
        status: "error",
        message: "fileName is required",
      });
    }

    // 1. Insert the file with proper version initialization
    const initialSummary = summary ? { 1: summary } : {};
    const initialOverview = overview ? { 1: overview } : {};
    const initialRecommendations = recommendations ? { 1: recommendations } : {};
    
    const result = await pool.query(
      `INSERT INTO tbl_files 
        (file_name, user_id, original_version, last_edits_version, summary, overview, recommendations)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING file_id, file_name, original_version, createdat, summary, overview, recommendations`,
      [
        fileName,
        userId,
        jsonData,
        null,
        JSON.stringify(initialSummary),
        JSON.stringify(initialOverview),
        JSON.stringify(initialRecommendations),
      ]
    );

    // 2. Get the user's plan_id
    const planResult = await pool.query(
      `SELECT fk_plan_id AS plan_id
         FROM tbl_users
        WHERE user_id = $1`,
      [userId]
    );

    if (planResult.rowCount === 0 || !planResult.rows[0].plan_id) {
      return res.status(400).json({
        status: "error",
        message: "User does not have a valid plan",
      });
    }

    const planId = planResult.rows[0].plan_id;

    // 3. Update or insert into usage table
    const usageResult = await pool.query(
      `SELECT number_of_uploads
         FROM tbl_user_plan_usage
        WHERE user_id = $1 AND plan_id = $2`,
      [userId, planId]
    );

    if (usageResult.rowCount === 0) {
      // Insert fresh usage row
      await pool.query(
        `INSERT INTO tbl_user_plan_usage
           (user_id, plan_id, number_of_uploads, refine_requests, analysis_requests, updated_at)
         VALUES ($1, $2, 1, 0, 0, CURRENT_TIMESTAMP)`,
        [userId, planId]
      );
    } else {
      // Increment uploads
      await pool.query(
        `UPDATE tbl_user_plan_usage
            SET number_of_uploads = number_of_uploads + 1,
                updated_at = CURRENT_TIMESTAMP
          WHERE user_id = $1 AND plan_id = $2`,
        [userId, planId]
      );
    }

    // 4. Return response
    res.status(201).json({
      status: "success",
      message: "Saved successfully",
      data: {
        fileId: result.rows[0].file_id,
        fileName: result.rows[0].file_name,
        originalVersion: result.rows[0].original_version,
        createdAt: result.rows[0].createdat,
        summary: result.rows[0].summary,
        overview: result.rows[0].overview,
        recommendations: result.rows[0].recommendations,
      },
    });
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({
      status: "error",
      message: "Failed to save file",
    });
  }
};

export const checkUploadLimit = async (req, res) => {
  const userId = req.user.user_id;

  try {
    const planResult = await pool.query(
      `SELECT p.number_of_uploads
        FROM tbl_users u
        JOIN tbl_plans p ON u.fk_plan_id = p.plan_id
        WHERE u.user_id = $1`,
      [userId]
    );

    if (planResult.rows.length === 0) {
      return res
        .status(404)
        .json({ allowed: false, message: "User plan not found" });
    }

    const uploadLimit = planResult.rows[0].number_of_uploads;

    // Get user's plan_id
    const userPlanResult = await pool.query(
      `SELECT fk_plan_id AS plan_id
         FROM tbl_users
        WHERE user_id = $1`,
      [userId]
    );

    if (userPlanResult.rowCount === 0 || !userPlanResult.rows[0].plan_id) {
      return res.status(400).json({
        allowed: false,
        message: "User does not have a valid plan",
      });
    }

    const userPlanId = userPlanResult.rows[0].plan_id;

    // Check usage from tbl_user_plan_usage
    const usageResult = await pool.query(
      `SELECT number_of_uploads
         FROM tbl_user_plan_usage
        WHERE user_id = $1 AND plan_id = $2`,
      [userId, userPlanId]
    );

    const usedUploads = usageResult.rows.length
      ? usageResult.rows[0].number_of_uploads
      : 0;

    if (usedUploads >= uploadLimit) {
      return res.status(403).json({
        allowed: false,
        message: `Upload limit reached. Your plan allows only ${uploadLimit} uploads.`,
      });
    }

    res.json({
      allowed: true,
      remaining: uploadLimit - usedUploads,
    });
  } catch (err) {
    res.status(500).json({ allowed: false, message: "Server error" });
  }
};

export const uploadAnalysis = async (req, res) => {
  const { fileId } = req.params;
  const { analysis } = req.body;
  const userId = req.user.user_id;

  try {
    if (!analysis) {
      return res.status(400).json({
        status: "error",
        message: "Analysis is required",
      });
    }

    // 1. Ensure file belongs to this user
    const fileCheck = await pool.query(
      `SELECT file_id FROM tbl_files WHERE file_id = $1 AND user_id = $2`,
      [fileId, userId]
    );

    if (fileCheck.rowCount === 0) {
      return res.status(404).json({
        status: "error",
        message: "File not found or unauthorized",
      });
    }

    // 2. Update file with analysis
    const result = await pool.query(
      `UPDATE tbl_files 
       SET analysis = $1,
           updatedat = CURRENT_TIMESTAMP
       WHERE file_id = $2 AND user_id = $3
       RETURNING file_id, file_name, analysis, updatedat`,
      [analysis, fileId, userId]
    );

    // 3. Get user's plan_id from tbl_users
const planResult = await pool.query(
  `SELECT fk_plan_id AS plan_id
     FROM tbl_users
    WHERE user_id = $1`,
  [userId]
);

if (planResult.rowCount === 0 || !planResult.rows[0].plan_id) {
  return res.status(400).json({
    status: "error",
    message: "User does not have a valid plan",
  });
}

const planId = planResult.rows[0].plan_id;

// 4. Check if usage row exists
const usageResult = await pool.query(
  `SELECT analysis_requests 
     FROM tbl_user_plan_usage 
    WHERE user_id = $1 AND plan_id = $2`,
  [userId, planId]
);

if (usageResult.rowCount === 0) {
  // Insert fresh usage row
  await pool.query(
    `INSERT INTO tbl_user_plan_usage 
       (user_id, plan_id, number_of_uploads, refine_requests, analysis_requests, updated_at)
     VALUES ($1, $2, 0, 0, 1, CURRENT_TIMESTAMP)`,
    [userId, planId]
  );
} else {
  // Update existing usage row
  await pool.query(
    `UPDATE tbl_user_plan_usage
        SET analysis_requests = analysis_requests + 1,
            updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND plan_id = $2`,
    [userId, planId]
  );
}

    res.status(200).json({
      status: "success",
      message: "Analysis saved successfully",
      data: result.rows[0],
    });
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({
      status: "error",
      message: "Failed to save analysis",
    });
  }
};

export const checkAnalysisLimit = async (req, res) => {
  const userId = req.user.user_id;

  try {
    const planResult = await pool.query(
      `SELECT p.analysis_requests
        FROM tbl_users u
        JOIN tbl_plans p ON u.fk_plan_id = p.plan_id
        WHERE u.user_id = $1`,
      [userId]
    );

    if (planResult.rows.length === 0) {
      return res.status(404).json({
        allowed: false,
        message: "User plan not found",
      });
    }

    const analysisLimit = planResult.rows[0].analysis_requests;

    // Get user's plan_id
    const userPlanResult = await pool.query(
      `SELECT fk_plan_id AS plan_id
         FROM tbl_users
        WHERE user_id = $1`,
      [userId]
    );

    if (userPlanResult.rowCount === 0 || !userPlanResult.rows[0].plan_id) {
      return res.status(400).json({
        allowed: false,
        message: "User does not have a valid plan",
      });
    }

    const userPlanId = userPlanResult.rows[0].plan_id;

    // Check usage from tbl_user_plan_usage
    const usageResult = await pool.query(
      `SELECT analysis_requests
         FROM tbl_user_plan_usage
        WHERE user_id = $1 AND plan_id = $2`,
      [userId, userPlanId]
    );

    const usedAnalysis = usageResult.rows.length
      ? usageResult.rows[0].analysis_requests
      : 0;

    if (usedAnalysis >= analysisLimit) {
      return res.status(403).json({
        allowed: false,
        message: `Analysis limit reached. Your plan allows only ${analysisLimit} analysis.`,
      });
    }

    res.json({
      allowed: true,
      remaining: analysisLimit - usedAnalysis,
    });
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({
      allowed: false,
      message: "Server error",
    });
  }
};

export const updateFile = async (req, res) => {
  const { fileId } = req.params;
  const { jsonData, summary, overview, recommendations, number_of_refines } = req.body;
  const userId = req.user.user_id;

  try {
    // Get current file data including existing versions
    const fileCheck = await pool.query(
      `SELECT file_id, last_edits_version, summary, overview, recommendations FROM tbl_files 
        WHERE file_id = $1 AND user_id = $2`,
      [fileId, userId]
    );

    if (fileCheck.rows.length === 0) {
      return res.status(404).json({
        status: "error",
        message: "File not found or unauthorized",
      });
    }

    const currentFile = fileCheck.rows[0];
    const existingVersions = currentFile.last_edits_version || {};
    const existingSummary = currentFile.summary || {};
    const existingOverview = currentFile.overview || {};
    const existingRecommendations = currentFile.recommendations || {};

    // Calculate next version number
    const versionNumbers = Object.keys(existingVersions)
      .filter((key) => !isNaN(parseInt(key)))
      .map((key) => parseInt(key))
      .sort((a, b) => b - a);
    
    const nextVersion = versionNumbers.length > 0 ? versionNumbers[0] + 1 : 2;

    // Create new version data
    const newVersions = {
      ...existingVersions,
      [nextVersion]: jsonData,
    };

    // Create new summary, overview, and recommendations with version-specific data
    const newSummary = {
      ...existingSummary,
      [nextVersion]: summary || existingSummary[nextVersion] || null,
    };

    const newOverview = {
      ...existingOverview,
      [nextVersion]: overview || existingOverview[nextVersion] || null,
    };

    const newRecommendations = {
      ...existingRecommendations,
      [nextVersion]: recommendations || existingRecommendations[nextVersion] || null,
    };
    
    const result = await pool.query(
      `UPDATE tbl_files 
        SET 
          last_edits_version = $1,
          summary = $2,
          updatedat = CURRENT_TIMESTAMP,
          overview = $3,
          recommendations = $4
        WHERE file_id = $5 AND user_id = $6
        RETURNING file_id, file_name, last_edits_version, summary, overview, recommendations, updatedat`,
      [
        JSON.stringify(newVersions),
        JSON.stringify(newSummary),
        JSON.stringify(newOverview),
        JSON.stringify(newRecommendations),
        fileId,
        userId,
      ]
    );

    // ✅ Increment refine usage if number_of_refines is provided
    if (number_of_refines && !isNaN(number_of_refines)) {
      const usageResult = await pool.query(
        `SELECT refine_requests 
           FROM tbl_user_plan_usage 
          WHERE user_id = $1 
          ORDER BY updated_at DESC 
          LIMIT 1`,
        [userId]
      );

      if (usageResult.rows.length === 0) {
        // insert new usage row
        await pool.query(
          `INSERT INTO tbl_user_plan_usage (user_id, refine_requests, updated_at)
           VALUES ($1, $2, CURRENT_TIMESTAMP)`,
          [userId, number_of_refines]
        );
      } else {
        // update existing
        const current = parseInt(usageResult.rows[0].refine_requests, 10);
        const newCount = current + parseInt(number_of_refines, 10);

        await pool.query(
          `UPDATE tbl_user_plan_usage
              SET refine_requests = $1,
                  updated_at = CURRENT_TIMESTAMP
            WHERE user_id = $2`,
          [newCount, userId]
        );
      }
    }

    res.status(200).json({
      status: "success",
      message: "Refined successfully",
      data: {
        fileId: result.rows[0].file_id,
        fileName: result.rows[0].file_name,
        currentVersion: nextVersion,
        allVersions: Object.keys(newVersions)
          .map((v) => parseInt(v))
          .sort((a, b) => a - b),
        refinedVersion: result.rows[0].last_edits_version,
        summary: result.rows[0].summary,
        overview: result.rows[0].overview,
        recommendations: result.rows[0].recommendations,
        updatedAt: result.rows[0].updatedat,
      },
    });
  } catch (err) {
    console.error("Database error:", err);

    if (err.code === "22P02") {
      return res.status(400).json({
        status: "error",
        message: "Invalid JSON data format",
      });
    }

    res.status(500).json({
      status: "error",
      message: "Failed to update file",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

export const getAllContracts = async (req, res) => {
  try {
    const query = `
  SELECT 
    f.file_id,
    f.file_name,
    f.createdat,
    f.updatedat,
    f.original_version,
    f.last_edits_version,
    f.summary,
    f.analysis,
    u.user_id,
    u.name AS user_name
  FROM tbl_files f
  INNER JOIN tbl_users u ON f.user_id = u.user_id
  ORDER BY f.createdat DESC
`;

    const result = await pool.query(query);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "No contracts found" });
    }

    res.status(200).json({
      status: "success",
      message: "Data fetched successfully",
      count: result.rowCount,
      data: result.rows,
    });
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch contracts",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

export const deleteFile = async (req, res) => {
  const { id } = req.params;

  try {
    // Check if file exists and belongs to user
    const fileCheck = await pool.query(
      `SELECT file_id FROM tbl_files WHERE file_id = $1`,
      [id]
    );

    if (fileCheck.rowCount === 0) {
      return res.status(404).json({
        status: "error",
        message: "File not found or unauthorized",
      });
    }

    // Delete the file
    const result = await pool.query(
      `DELETE FROM tbl_files WHERE file_id = $1 RETURNING file_id, file_name`,
      [id]
    );

    res.status(200).json({
      status: "success",
      message: "File deleted successfully",
      deletedFile: result.rows[0],
    });
  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({
      status: "error",
      message: "Failed to delete file",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

export const checkRefineLimit = async (req, res) => {
  const userId = req.user.user_id;
  const { possible_refines } = req.body;

  if (!possible_refines || isNaN(possible_refines)) {
    return res.status(400).json({
      allowed: false,
      message: "possible_refines is required and must be a number",
    });
  }

  try {
    const planResult = await pool.query(
      `SELECT p.refine_requests
         FROM tbl_users u
         JOIN tbl_plans p ON u.fk_plan_id = p.plan_id
        WHERE u.user_id = $1`,
      [userId]
    );

    if (planResult.rows.length === 0) {
      return res.status(404).json({
        allowed: false,
        message: "User plan not found",
      });
    }

    const refineLimit = planResult.rows[0].refine_requests;

    const usageResult = await pool.query(
      `SELECT refine_requests 
         FROM tbl_user_plan_usage 
        WHERE user_id = $1 
        ORDER BY updated_at DESC 
        LIMIT 1`,
      [userId]
    );

    const usedRefines = usageResult.rows.length
      ? usageResult.rows[0].refine_requests
      : 0;

    const remaining = refineLimit - usedRefines;

    if (possible_refines > remaining) {
      return res.status(403).json({
        allowed: false,
        message: `Refine request denied. Your plan allows ${refineLimit} refines, you used ${usedRefines}, remaining ${remaining}, but requested ${possible_refines}.`,
        remaining,
      });
    }

    return res.json({
      allowed: true,
      message: `Refine request accepted. You can use ${possible_refines} refines.`,
      remaining: remaining - possible_refines,
    });
  } catch (err) {
    console.error("checkRefineLimit error:", err);
    res.status(500).json({
      allowed: false,
      message: "Server error",
    });
  }
};

// Helper function to get all versions of a file
export const getAllFileVersions = async (req, res) => {
  const { fileId } = req.params;
  const userId = req.user.user_id;

  try {
    const fileCheck = await pool.query(
      `SELECT file_id, file_name, original_version, last_edits_version, summary, overview, recommendations, analysis, createdat, updatedat
       FROM tbl_files 
       WHERE file_id = $1 AND user_id = $2`,
      [fileId, userId]
    );

    if (fileCheck.rowCount === 0) {
      return res.status(404).json({
        status: "error",
        message: "File not found or unauthorized",
      });
    }

    const file = fileCheck.rows[0];
    const versions = [];

    // Add version 1 (original)
    versions.push({
      versionNumber: 1,
      data: file.original_version,
      summary: file.summary?.[1] || null,
      overview: file.overview?.[1] || null,
      recommendations: file.recommendations?.[1] || null,
      createdAt: file.createdat,
    });

    // Add all other versions
    if (file.last_edits_version) {
      const additionalVersions = Object.keys(file.last_edits_version)
        .filter((key) => !isNaN(parseInt(key)))
        .map((key) => parseInt(key))
        .sort((a, b) => a - b);

      additionalVersions.forEach((versionNum) => {
        versions.push({
          versionNumber: versionNum,
          data: file.last_edits_version[versionNum.toString()],
          summary: file.summary?.[versionNum.toString()] || null,
          overview: file.overview?.[versionNum.toString()] || null,
          recommendations: file.recommendations?.[versionNum.toString()] || null,
          createdAt: file.updatedat, // Approximate, as we don't track individual version timestamps
        });
      });
    }

    res.status(200).json({
      status: "success",
      message: "All versions retrieved successfully",
      data: {
        fileId: file.file_id,
        fileName: file.file_name,
        totalVersions: versions.length,
        versions: versions,
      },
    });
  } catch (err) {
    console.error("getAllFileVersions error:", err);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch file versions",
    });
  }
};

// Helper function to get the latest version of a file
export const getLatestFileVersion = async (req, res) => {
  const { fileId } = req.params;
  const userId = req.user.user_id;

  try {
    const fileCheck = await pool.query(
      `SELECT file_id, file_name, original_version, last_edits_version, summary, overview, recommendations, analysis, createdat, updatedat
       FROM tbl_files 
       WHERE file_id = $1 AND user_id = $2`,
      [fileId, userId]
    );

    if (fileCheck.rowCount === 0) {
      return res.status(404).json({
        status: "error",
        message: "File not found or unauthorized",
      });
    }

    const file = fileCheck.rows[0];
    let latestVersion, latestSummary, latestOverview, latestRecommendations, versionNumber;

    if (
      file.last_edits_version &&
      Object.keys(file.last_edits_version).length > 0
    ) {
      // Get the highest version number
      const versionNumbers = Object.keys(file.last_edits_version)
        .filter((key) => !isNaN(parseInt(key)))
        .map((key) => parseInt(key))
        .sort((a, b) => b - a);
      
      versionNumber = versionNumbers[0];
      latestVersion = file.last_edits_version[versionNumber.toString()];
      latestSummary = file.summary?.[versionNumber.toString()] || null;
      latestOverview = file.overview?.[versionNumber.toString()] || null;
      latestRecommendations = file.recommendations?.[versionNumber.toString()] || null;
    } else {
      // No edits, return original version
      versionNumber = 1;
      latestVersion = file.original_version;
      latestSummary = file.summary?.[1] || null;
      latestOverview = file.overview?.[1] || null;
      latestRecommendations = file.recommendations?.[1] || null;
    }

    res.status(200).json({
      status: "success",
      message: "Latest version retrieved successfully",
      data: {
        fileId: file.file_id,
        fileName: file.file_name,
        versionNumber: versionNumber,
        version: latestVersion,
        summary: latestSummary,
        overview: latestOverview,
        recommendations: latestRecommendations,
        updatedAt: file.updatedat,
      },
    });
  } catch (err) {
    console.error("getLatestFileVersion error:", err);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch latest version",
    });
  }
};

export const getFileVersion = async (req, res) => {
  const { fileId } = req.params;
  const { version } = req.body; 
  const userId = req.user.user_id;

  try {
    if (!version) {
      return res.status(400).json({
        status: "error",
        message: "Version number is required",
      });
    }

    const fileCheck = await pool.query(
      `SELECT file_id, file_name, original_version, last_edits_version, summary, overview, recommendations, analysis
       FROM tbl_files 
       WHERE file_id = $1 AND user_id = $2`,
      [fileId, userId]
    );

    if (fileCheck.rowCount === 0) {
      return res.status(404).json({
        status: "error",
        message: "File not found or unauthorized",
      });
    }

    const file = fileCheck.rows[0];
    let versionData, summaryData, overviewData, recommendationsData;

    if (version === 1) {
      // Version 1 is always the original version
      versionData = file.original_version;
      summaryData = file.summary?.[1] || null;
      overviewData = file.overview?.[1] || null;
      recommendationsData = file.recommendations?.[1] || null;
    } else {
      // For versions 2+, check in last_edits_version
      const lastEdits = file.last_edits_version || {};
      const versionStr = version.toString();

      if (!(versionStr in lastEdits)) {
        return res.status(404).json({
          status: "error",
          message: `Version ${version} not found`,
        });
      }

      versionData = lastEdits[versionStr];
      summaryData = file.summary?.[versionStr] || null;
      overviewData = file.overview?.[versionStr] || null;
      recommendationsData = file.recommendations?.[versionStr] || null;
    }

    // Get all available versions for reference
    const allVersions = [1]; // Always include version 1
    if (file.last_edits_version) {
      const additionalVersions = Object.keys(file.last_edits_version)
        .filter((key) => !isNaN(parseInt(key)))
        .map((key) => parseInt(key))
        .sort((a, b) => a - b);
      allVersions.push(...additionalVersions);
    }

    res.status(200).json({
      status: "success",
      message: `Version ${version} retrieved successfully`,
      data: {
        version: versionData,
        summary: summaryData,
        overview: overviewData,
        recommendations: recommendationsData,
        versionNumber: version,
        allAvailableVersions: allVersions,
      },
    });
  } catch (err) {
    console.error("getFileVersion error:", err);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch version",
    });
  }
};

export const getUserFiles = async (req, res) => {
  const userId = req.user.user_id;

  try {
    const query = `
      SELECT 
        f.file_id,
        f.file_name,
        f.createdat,
        f.updatedat,
        f.original_version,
        f.last_edits_version,
        f.summary,
        f.overview,
        f.recommendations,
        f.analysis,
        u.user_id,
        u.name AS user_name,
        u.email AS user_email
      FROM tbl_files f
      INNER JOIN tbl_users u ON f.user_id = u.user_id
      WHERE f.user_id = $1
      ORDER BY f.createdat DESC
    `;

    const result = await pool.query(query, [userId]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: "success",
        message: "No files found for this user",
        count: 0,
        data: [],
      });
    }

    // Transform the data to include version information
    const transformedFiles = result.rows.map((file) => {
      const versions = [];

      // Add version 1 (original)
      versions.push({
        versionNumber: 1,
        data: file.original_version,
        summary: file.summary?.[1] || null,
        overview: file.overview?.[1] || null,
        recommendations: file.recommendations?.[1] || null,
        createdAt: file.createdat,
      });

      // Add all other versions
      if (file.last_edits_version) {
        const additionalVersions = Object.keys(file.last_edits_version)
          .filter((key) => !isNaN(parseInt(key)))
          .map((key) => parseInt(key))
          .sort((a, b) => a - b);

        additionalVersions.forEach((versionNum) => {
          versions.push({
            versionNumber: versionNum,
            data: file.last_edits_version[versionNum.toString()],
            summary: file.summary?.[versionNum.toString()] || null,
            overview: file.overview?.[versionNum.toString()] || null,
            recommendations: file.recommendations?.[versionNum.toString()] || null,
            createdAt: file.updatedat,
          });
        });
      }

      // Extract intro from original version
      const intro = file.original_version?.intro || null;

      return {
        fileId: file.file_id,
        fileName: file.file_name,
        createdAt: file.createdat,
        updatedAt: file.updatedat,
        totalVersions: versions.length,
        // versions: versions,
        intro: intro,
        // analysis: file.analysis,
        user: {
          userId: file.user_id,
          name: file.user_name,
          email: file.user_email,
        },
      };
    });

    res.status(200).json({
      status: "success",
      message: "User files retrieved successfully",
      count: result.rowCount,
      data: transformedFiles,
    });
  } catch (err) {
    console.error("getUserFiles error:", err);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch user files",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

export const getFileVersionsCount = async (req, res) => {
  const { fileId } = req.params;
  const userId = req.user.user_id;

  try {
    const fileCheck = await pool.query(
      `SELECT file_id, file_name, original_version, last_edits_version
       FROM tbl_files 
       WHERE file_id = $1 AND user_id = $2`,
      [fileId, userId]
    );

    if (fileCheck.rowCount === 0) {
      return res.status(404).json({
        status: "error",
        message: "File not found or unauthorized",
      });
    }

    const file = fileCheck.rows[0];
    let totalVersions = 1; // Always count original version

    // Count additional versions
    if (file.last_edits_version) {
      const additionalVersions = Object.keys(file.last_edits_version).filter(
        (key) => !isNaN(parseInt(key))
      ).length;
      totalVersions += additionalVersions;
    }

    res.status(200).json({
      status: "success",
      message: "File versions count retrieved successfully",
      data: {
        fileId: file.file_id,
        fileName: file.file_name,
        totalVersions: totalVersions,
      },
    });
  } catch (err) {
    console.error("getFileVersionsCount error:", err);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch file versions count",
    });
  }
};

export const getFileById = async (req, res) => {
  const { fileId } = req.params;
  const userId = req.user.user_id;

  try {
    const query = `
      SELECT 
        f.file_id,
        f.file_name,
        f.createdat,
        f.updatedat,
        f.original_version,
        f.last_edits_version,
        f.summary,
        f.overview,
        f.recommendations,
        f.analysis,
        u.user_id,
        u.name AS user_name,
        u.email AS user_email
      FROM tbl_files f
      INNER JOIN tbl_users u ON f.user_id = u.user_id
      WHERE f.file_id = $1 AND f.user_id = $2
    `;

    const result = await pool.query(query, [fileId, userId]);

    if (result.rowCount === 0) {
      return res.status(404).json({
        status: "error",
        message: "File not found or unauthorized",
      });
    }

    const file = result.rows[0];
    const versions = [];

    // Add version 1 (original)
    versions.push({
      versionNumber: 1,
      data: file.original_version,
      summary: file.summary?.[1] || null,
      overview: file.overview?.[1] || null,
      recommendations: file.recommendations?.[1] || null,
      createdAt: file.createdat,
    });

    // Add all other versions
    // if (file.last_edits_version) {
    //   const additionalVersions = Object.keys(file.last_edits_version)
    //     .filter((key) => !isNaN(parseInt(key)))
    //     .map((key) => parseInt(key))
    //     .sort((a, b) => a - b);

    //   additionalVersions.forEach((versionNum) => {
    //     versions.push({
    //       versionNumber: versionNum,
    //       data: file.last_edits_version[versionNum.toString()],
    //       summary: file.summary?.[versionNum.toString()] || null,
    //       overview: file.overview?.[versionNum.toString()] || null,
    //       recommendations: file.recommendations?.[versionNum.toString()] || null,
    //       createdAt: file.updatedat,
    //     });
    //   });
    // }

    // Extract intro from original version
    const intro = file.original_version?.intro || null;

    res.status(200).json({
      status: "success",
      message: "File details retrieved successfully",
      data: {
        fileId: file.file_id,
        fileName: file.file_name,
        createdAt: file.createdat,
        updatedAt: file.updatedat,
        // totalVersions: versions.length,
        versions: versions,
        // intro: intro,
        // analysis: file.analysis,
        // user: {
        //   userId: file.user_id,
        //   name: file.user_name,
        //   email: file.user_email,
        // },
      },
    });
  } catch (err) {
    console.error("getFileById error:", err);
    res.status(500).json({
      status: "error",
      message: "Failed to fetch file details",
      details: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

