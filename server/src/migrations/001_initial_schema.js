/**
 * Initial schema. Each migration exports an async `up({ run })` — the runner
 * (scripts/migrate.js) calls it once and records the version in
 * `schema_migrations` so it never runs again.
 *
 * Statements are ordered so foreign-key targets exist before they're referenced.
 */
const STATEMENTS = [
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

export async function up({ run }) {
  for (const stmt of STATEMENTS) {
    await run(stmt);
  }
}
