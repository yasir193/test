import { pool } from "../../../DB/connection.js";
import { v4 as uuidv4 } from "uuid";

export const startChat = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const chatId = uuidv4();

    res.json({ chatId });
  } catch (err) {
    console.error("Start Chat Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const sendUserMessage = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { chatId, message } = req.body;

    const result = await pool.query(
      `INSERT INTO tbl_chats (chat_id, user_id, sender, message)
       VALUES ($1, $2, 'user', $3)
       RETURNING *`,
      [chatId, userId, message]
    );

    res.json({ message: "User message saved", data: result.rows[0] });
  } catch (err) {
    console.error("Send User Message Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const sendAIMessage = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { chatId, jsonResponse } = req.body;

    const result = await pool.query(
      `INSERT INTO tbl_chats (chat_id, user_id, sender, json_response)
       VALUES ($1, $2, 'ai', $3)
       RETURNING *`,
      [chatId, userId, jsonResponse]
    );

    res.json({ message: "AI message saved", data: result.rows[0] });
  } catch (err) {
    console.error("Send AI Message Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getChatHistory = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { chatId } = req.params;

    const result = await pool.query(
      `SELECT * FROM tbl_chats
        WHERE chat_id = $1 AND user_id = $2
        ORDER BY created_at ASC`,
      [chatId, userId]
    );

    res.json({ chat: result.rows });
  } catch (err) {
    console.error("Get Chat History Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
