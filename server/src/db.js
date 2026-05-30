import mysql from "mysql2/promise";
import { config } from "./config.js";

/**
 * MySQL connection pool + async query helpers. Schema creation and seeding live
 * in the migration/seed scripts (npm run db:migrate / db:seed), NOT here — the
 * app no longer mutates the schema on boot, so multiple instances can't race on
 * DDL and migrations run as an explicit deploy step.
 *
 * `dateStrings: true` keeps DATETIME columns returning "YYYY-MM-DD HH:MM:SS"
 * strings (matching the old SQLite output) so response shapes don't change.
 */
const pool = mysql.createPool({
  host: config.mysql.host,
  port: config.mysql.port,
  user: config.mysql.user,
  password: config.mysql.password,
  database: config.mysql.database,
  ssl: config.mysql.ssl,
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true,
  charset: "utf8mb4_unicode_ci",
});

/** Return all rows (replaces `db.prepare(sql).all(...)`). */
export async function all(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

/** Return the first row or undefined (replaces `db.prepare(sql).get(...)`). */
export async function get(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows[0];
}

/**
 * Run a write and return the result header (replaces `db.prepare(sql).run(...)`).
 * Use result.insertId (was lastInsertRowid) and result.affectedRows.
 */
export async function run(sql, params = []) {
  const [result] = await pool.query(sql, params);
  return result;
}

/** Close the pool during graceful shutdown / at the end of a CLI script. */
export async function closeDb() {
  await pool.end();
}

export default pool;
