import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const db = new Database(join(__dirname, "..", "aidvocate.db"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    passwordHash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'donor',
    firstName TEXT,
    lastName TEXT,
    username TEXT,
    contactNumber TEXT,
    dob TEXT,
    location TEXT,
    interestedIn TEXT,
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS ngos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    walletAddress TEXT,
    createdAt TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS organizations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    coverImage TEXT,
    logo TEXT,
    location TEXT,
    contactEmail TEXT,
    contactPhone TEXT,
    website TEXT,
    walletAddress TEXT,
    ngoId INTEGER,
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (ngoId) REFERENCES ngos(id)
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS organization_categories (
    organizationId INTEGER NOT NULL,
    categoryId INTEGER NOT NULL,
    PRIMARY KEY (organizationId, categoryId),
    FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE,
    FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    organizationId INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    image TEXT,
    location TEXT,
    dateStart TEXT NOT NULL,
    dateEnd TEXT,
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS event_categories (
    eventId INTEGER NOT NULL,
    categoryId INTEGER NOT NULL,
    PRIMARY KEY (eventId, categoryId),
    FOREIGN KEY (eventId) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (categoryId) REFERENCES categories(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS organization_likes (
    userId INTEGER NOT NULL,
    organizationId INTEGER NOT NULL,
    createdAt TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (userId, organizationId),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS event_likes (
    userId INTEGER NOT NULL,
    eventId INTEGER NOT NULL,
    createdAt TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (userId, eventId),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (eventId) REFERENCES events(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS organization_volunteers (
    userId INTEGER NOT NULL,
    organizationId INTEGER NOT NULL,
    createdAt TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (userId, organizationId),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (organizationId) REFERENCES organizations(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS event_volunteers (
    userId INTEGER NOT NULL,
    eventId INTEGER NOT NULL,
    createdAt TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (userId, eventId),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (eventId) REFERENCES events(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS donations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    donorId INTEGER,
    ngoId INTEGER NOT NULL,
    organizationId INTEGER,
    eventId INTEGER,
    amount REAL NOT NULL,
    timestamp INTEGER NOT NULL,
    salt TEXT NOT NULL,
    commitment TEXT NOT NULL,
    batchId INTEGER,
    paymentStatus TEXT DEFAULT 'pending',
    paymentReference TEXT,
    description TEXT,
    guestName TEXT,
    guestEmail TEXT,
    guestContact TEXT,
    isAnonymous INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (donorId) REFERENCES users(id),
    FOREIGN KEY (ngoId) REFERENCES ngos(id),
    FOREIGN KEY (organizationId) REFERENCES organizations(id),
    FOREIGN KEY (eventId) REFERENCES events(id)
  );

  CREATE TABLE IF NOT EXISTS batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    merkleRoot TEXT NOT NULL,
    commitments TEXT NOT NULL,
    txHash TEXT,
    status TEXT DEFAULT 'pending',
    createdAt TEXT DEFAULT (datetime('now'))
  );
`);

// Idempotent migrations for installations created before guest-donation columns existed.
function tryAddColumn(table, column, definition) {
  try {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  } catch (err) {
    if (!/duplicate column/i.test(err.message)) throw err;
  }
}
tryAddColumn("donations", "guestName", "TEXT");
tryAddColumn("donations", "guestEmail", "TEXT");
tryAddColumn("donations", "guestContact", "TEXT");
tryAddColumn("donations", "isAnonymous", "INTEGER NOT NULL DEFAULT 0");

const ngoCount = db.prepare("SELECT COUNT(*) as count FROM ngos").get().count;
if (ngoCount === 0) {
  const insert = db.prepare("INSERT INTO ngos (name, description) VALUES (?, ?)");
  insert.run("Red Cross PH", "Philippine Red Cross - humanitarian organization");
  insert.run("Gawad Kalinga", "Community development through shelter and livelihood");
  insert.run("ABS-CBN Foundation", "Education, environment, and public service");
}

const orgCount = db.prepare("SELECT COUNT(*) as count FROM organizations").get().count;
if (orgCount === 0) {
  const orgInsert = db.prepare(
    "INSERT INTO organizations (name, description, location, ngoId) VALUES (?, ?, ?, ?)"
  );
  orgInsert.run(
    "Bantay Bata 163",
    "Philippine non-profit organization serving abused, abandoned, and neglected children.",
    "Quezon City",
    1
  );
  orgInsert.run(
    "Gawad Kalinga Davao",
    "Building communities through shelter, livelihood, education and healthcare for the poorest of the poor.",
    "Davao City",
    2
  );
  orgInsert.run(
    "PAWS Philippines",
    "Promoting animal welfare through responsible pet ownership, rescue, and education.",
    "Manila",
    null
  );
  orgInsert.run(
    "Haribon Foundation",
    "Environmental protection through community-based conservation programs across the Philippines.",
    "Quezon City",
    null
  );
}

const catCount = db.prepare("SELECT COUNT(*) as count FROM categories").get().count;
if (catCount === 0) {
  const catInsert = db.prepare("INSERT OR IGNORE INTO categories (name) VALUES (?)");
  const seed = [
    "Education", "Health Care", "Environment", "Animal Welfare", "Child Protection",
    "Feeding Program", "Disaster Relief", "Community Support", "Mental Health",
    "Elderly Care", "Sustainability", "Tree Planting"
  ];
  for (const c of seed) catInsert.run(c);

  const linkOrgCat = db.prepare(
    "INSERT OR IGNORE INTO organization_categories (organizationId, categoryId) VALUES ((SELECT id FROM organizations WHERE name = ?), (SELECT id FROM categories WHERE name = ?))"
  );
  linkOrgCat.run("Bantay Bata 163", "Child Protection");
  linkOrgCat.run("Bantay Bata 163", "Education");
  linkOrgCat.run("Gawad Kalinga Davao", "Community Support");
  linkOrgCat.run("Gawad Kalinga Davao", "Disaster Relief");
  linkOrgCat.run("PAWS Philippines", "Animal Welfare");
  linkOrgCat.run("Haribon Foundation", "Environment");
  linkOrgCat.run("Haribon Foundation", "Sustainability");
}

const eventCount = db.prepare("SELECT COUNT(*) as count FROM events").get().count;
if (eventCount === 0) {
  const nowMs = Date.now();
  const days = (d) => new Date(nowMs + d * 86400000).toISOString();
  const evInsert = db.prepare(
    "INSERT INTO events (organizationId, name, description, location, dateStart, dateEnd) VALUES (?, ?, ?, ?, ?, ?)"
  );
  evInsert.run(
    1,
    "Children Welfare Drive",
    "Help us collect supplies and donations for abused and neglected children across Metro Manila.",
    "Quezon City Memorial Circle",
    days(7),
    days(7)
  );
  evInsert.run(
    2,
    "GK Build Day - Davao",
    "Volunteer building day at our Davao village. Help construct shelter for families in need.",
    "Tugbok, Davao City",
    days(14),
    days(14)
  );
  evInsert.run(
    3,
    "Stray Animal Adoption Day",
    "Find your forever friend! Adoption drive featuring rescued cats and dogs.",
    "BGC Open Park, Taguig",
    days(21),
    days(21)
  );
  evInsert.run(
    4,
    "Mangrove Tree Planting",
    "Join Haribon for our annual mangrove restoration in Quezon. Tools and snacks provided.",
    "Polillo Island, Quezon",
    days(28),
    days(28)
  );
}

export default db;
