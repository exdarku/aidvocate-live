import mysql from "mysql2/promise";
import { config } from "./config.js";

/**
 * MySQL connection pool. Replaces the previous synchronous better-sqlite3 setup
 * so the API can run against AWS RDS (or any MySQL) with proper persistence and
 * concurrent connections. All query helpers are async.
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

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(254) UNIQUE NOT NULL,
    passwordHash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'donor',
    firstName VARCHAR(100),
    lastName VARCHAR(100),
    username VARCHAR(100),
    contactNumber VARCHAR(20),
    dob VARCHAR(40),
    location VARCHAR(100),
    interestedIn VARCHAR(100),
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB`,

  `CREATE TABLE IF NOT EXISTS ngos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    walletAddress VARCHAR(100),
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB`,

  `CREATE TABLE IF NOT EXISTS organizations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    coverImage TEXT,
    logo TEXT,
    location VARCHAR(150),
    contactEmail VARCHAR(254),
    contactPhone VARCHAR(50),
    website VARCHAR(255),
    walletAddress VARCHAR(100),
    ngoId INT,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ngoId) REFERENCES ngos(id)
  ) ENGINE=InnoDB`,

  `CREATE TABLE IF NOT EXISTS categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL
  ) ENGINE=InnoDB`,

  `CREATE TABLE IF NOT EXISTS organization_categories (
    organizationId INT NOT NULL,
    categoryId INT NOT NULL,
    PRIMARY KEY (organizationId, categoryId),
    FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE CASCADE
  ) ENGINE=InnoDB`,

  `CREATE TABLE IF NOT EXISTS events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    organizationId INT NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    image TEXT,
    location VARCHAR(150),
    dateStart VARCHAR(40) NOT NULL,
    dateEnd VARCHAR(40),
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE
  ) ENGINE=InnoDB`,

  `CREATE TABLE IF NOT EXISTS event_categories (
    eventId INT NOT NULL,
    categoryId INT NOT NULL,
    PRIMARY KEY (eventId, categoryId),
    FOREIGN KEY (eventId) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE CASCADE
  ) ENGINE=InnoDB`,

  `CREATE TABLE IF NOT EXISTS organization_likes (
    userId INT NOT NULL,
    organizationId INT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (userId, organizationId),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE
  ) ENGINE=InnoDB`,

  `CREATE TABLE IF NOT EXISTS event_likes (
    userId INT NOT NULL,
    eventId INT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (userId, eventId),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (eventId) REFERENCES events(id) ON DELETE CASCADE
  ) ENGINE=InnoDB`,

  `CREATE TABLE IF NOT EXISTS organization_volunteers (
    userId INT NOT NULL,
    organizationId INT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (userId, organizationId),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE
  ) ENGINE=InnoDB`,

  `CREATE TABLE IF NOT EXISTS event_volunteers (
    userId INT NOT NULL,
    eventId INT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (userId, eventId),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (eventId) REFERENCES events(id) ON DELETE CASCADE
  ) ENGINE=InnoDB`,

  `CREATE TABLE IF NOT EXISTS donations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    donorId INT,
    ngoId INT NOT NULL,
    organizationId INT,
    eventId INT,
    amount DOUBLE NOT NULL,
    timestamp BIGINT NOT NULL,
    salt VARCHAR(255) NOT NULL,
    commitment VARCHAR(255) NOT NULL,
    batchId INT,
    paymentStatus VARCHAR(20) DEFAULT 'pending',
    paymentReference VARCHAR(64),
    description TEXT,
    guestName VARCHAR(200),
    guestEmail VARCHAR(254),
    guestContact VARCHAR(50),
    isAnonymous TINYINT NOT NULL DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (donorId) REFERENCES users(id),
    FOREIGN KEY (ngoId) REFERENCES ngos(id),
    FOREIGN KEY (organizationId) REFERENCES organizations(id),
    FOREIGN KEY (eventId) REFERENCES events(id)
  ) ENGINE=InnoDB`,

  `CREATE TABLE IF NOT EXISTS batches (
    id INT AUTO_INCREMENT PRIMARY KEY,
    merkleRoot VARCHAR(255) NOT NULL,
    commitments LONGTEXT NOT NULL,
    txHash VARCHAR(100),
    status VARCHAR(20) DEFAULT 'pending',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB`,
];

async function seed() {
  const { count: ngoCount } = (await get("SELECT COUNT(*) AS count FROM ngos")) || {};
  if (ngoCount === 0) {
    await run("INSERT INTO ngos (name, description) VALUES (?, ?)", ["Red Cross PH", "Philippine Red Cross - humanitarian organization"]);
    await run("INSERT INTO ngos (name, description) VALUES (?, ?)", ["Gawad Kalinga", "Community development through shelter and livelihood"]);
    await run("INSERT INTO ngos (name, description) VALUES (?, ?)", ["ABS-CBN Foundation", "Education, environment, and public service"]);
  }

  const { count: orgCount } = (await get("SELECT COUNT(*) AS count FROM organizations")) || {};
  if (orgCount === 0) {
    const orgs = [
      ["Bantay Bata 163", "Philippine non-profit organization serving abused, abandoned, and neglected children.", "Quezon City", 1],
      ["Gawad Kalinga Davao", "Building communities through shelter, livelihood, education and healthcare for the poorest of the poor.", "Davao City", 2],
      ["PAWS Philippines", "Promoting animal welfare through responsible pet ownership, rescue, and education.", "Manila", null],
      ["Haribon Foundation", "Environmental protection through community-based conservation programs across the Philippines.", "Quezon City", null],
    ];
    for (const o of orgs) {
      await run("INSERT INTO organizations (name, description, location, ngoId) VALUES (?, ?, ?, ?)", o);
    }
  }

  const { count: catCount } = (await get("SELECT COUNT(*) AS count FROM categories")) || {};
  if (catCount === 0) {
    const seedCats = [
      "Education", "Health Care", "Environment", "Animal Welfare", "Child Protection",
      "Feeding Program", "Disaster Relief", "Community Support", "Mental Health",
      "Elderly Care", "Sustainability", "Tree Planting",
    ];
    for (const c of seedCats) await run("INSERT IGNORE INTO categories (name) VALUES (?)", [c]);

    // Link via INSERT ... SELECT (MySQL-friendly: no subqueries in VALUES).
    const links = [
      ["Bantay Bata 163", "Child Protection"],
      ["Bantay Bata 163", "Education"],
      ["Gawad Kalinga Davao", "Community Support"],
      ["Gawad Kalinga Davao", "Disaster Relief"],
      ["PAWS Philippines", "Animal Welfare"],
      ["Haribon Foundation", "Environment"],
      ["Haribon Foundation", "Sustainability"],
    ];
    for (const [orgName, catName] of links) {
      await run(
        `INSERT IGNORE INTO organization_categories (organizationId, categoryId)
         SELECT o.id, c.id FROM organizations o, categories c WHERE o.name = ? AND c.name = ?`,
        [orgName, catName]
      );
    }
  }

  const { count: eventCount } = (await get("SELECT COUNT(*) AS count FROM events")) || {};
  if (eventCount === 0) {
    const nowMs = Date.now();
    const days = (d) => new Date(nowMs + d * 86400000).toISOString();
    const events = [
      [1, "Children Welfare Drive", "Help us collect supplies and donations for abused and neglected children across Metro Manila.", "Quezon City Memorial Circle", days(7), days(7)],
      [2, "GK Build Day - Davao", "Volunteer building day at our Davao village. Help construct shelter for families in need.", "Tugbok, Davao City", days(14), days(14)],
      [3, "Stray Animal Adoption Day", "Find your forever friend! Adoption drive featuring rescued cats and dogs.", "BGC Open Park, Taguig", days(21), days(21)],
      [4, "Mangrove Tree Planting", "Join Haribon for our annual mangrove restoration in Quezon. Tools and snacks provided.", "Polillo Island, Quezon", days(28), days(28)],
    ];
    for (const e of events) {
      await run(
        "INSERT INTO events (organizationId, name, description, location, dateStart, dateEnd) VALUES (?, ?, ?, ?, ?, ?)",
        e
      );
    }
  }
}

/** Create schema (idempotent) and seed reference data. Call once on boot. */
export async function initDb() {
  for (const stmt of SCHEMA) {
    await pool.query(stmt);
  }
  await seed();
}

/** Close the pool during graceful shutdown. */
export async function closeDb() {
  await pool.end();
}

export default pool;
