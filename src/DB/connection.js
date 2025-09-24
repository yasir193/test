import { Pool } from "pg";
import dotenv from "dotenv";
dotenv.config();

// export const pool = new Pool({
//   connectionString: process.env.DATABASE_URL,
// });


export const pool = new Pool({
  host: process.env.PGHOST,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  port: process.env.PGPORT,
});

export const database_connection = async () => {
  try {
    await pool.connect();
    console.log("PostgreSQL Connected Successfully");
  } catch (error) {
    if (error.code === 'ECONNRESET') {
      console.log('Database connection reset, reconnecting...');
    }
    console.error("Database connection error:", error);
    process.exit(1);
  }
};