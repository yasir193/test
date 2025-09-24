import { pool } from "../../../DB/connection.js";

export const addTemplate = async (req, res) => {
  try {
    const { name, type, content } = req.body;

    const checkQuery = `
      SELECT id FROM tbl_templates WHERE name = $1
    `;
    const checkResult = await pool.query(checkQuery, [name]);

    if (checkResult.rows.length > 0) {
      return res.status(409).json({
        error: "Template with this name already exists",
      });
    }

    
    const insertQuery = `
      INSERT INTO tbl_templates 
        (name,type ,content)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const values = [name, type, content];
    const result = await pool.query(insertQuery, values);

    res.json({
      message: "Template added successfully!",
      data: result.rows[0],
    });
  } catch (err) {
    res.status(500).json({message:"something went wrong" ,error: err.message });
  }
};

export const getAllTemplates = async (req, res) => {
  const query = `SELECT id, name, type FROM tbl_templates`;

  try {
    const result = await pool.query(query);
    const grouped = result.rows.reduce((acc, template) => {
      if (!acc[template.type]) {
        acc[template.type] = [];
      }
      acc[template.type].push(template);
      return acc;
    }, {});

    res.json({ message: "fetching data successfully", data: grouped });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


export const getSpecificTemplate = async (req, res) => {
  const { id } = req.params;

  const query = `
  select * from tbl_templates where id = ($1)
  `;

  const value = [id];

  const result = await pool.query(query, value);

  try {
    res.json({ message: "success", data: result.rows[0] });
  } catch (error) {
    res.json({ error: error.message });
  }
};
