/**
 * db:seed — insert reference data (NGOs, organizations, categories, events).
 *
 * Idempotent: each block is skipped if its table already has rows, so running
 * it repeatedly is safe. Requires the schema to exist (run db:migrate first).
 *
 * Usage: npm run db:seed
 */
import { all, get, run, closeDb } from "../src/db.js";

async function tablesExist() {
  try {
    await get("SELECT 1 FROM ngos LIMIT 1");
    return true;
  } catch (err) {
    if (err.code === "ER_NO_SUCH_TABLE") return false;
    throw err;
  }
}

async function seedNgos() {
  const { count } = await get("SELECT COUNT(*) AS count FROM ngos");
  if (count > 0) return false;
  const rows = [
    ["Red Cross PH", "Philippine Red Cross - humanitarian organization"],
    ["Gawad Kalinga", "Community development through shelter and livelihood"],
    ["ABS-CBN Foundation", "Education, environment, and public service"],
  ];
  for (const r of rows) await run("INSERT INTO ngos (name, description) VALUES (?, ?)", r);
  return true;
}

async function seedOrganizations() {
  const { count } = await get("SELECT COUNT(*) AS count FROM organizations");
  if (count > 0) return false;
  const orgs = [
    ["Bantay Bata 163", "Philippine non-profit organization serving abused, abandoned, and neglected children.", "Quezon City", 1],
    ["Gawad Kalinga Davao", "Building communities through shelter, livelihood, education and healthcare for the poorest of the poor.", "Davao City", 2],
    ["PAWS Philippines", "Promoting animal welfare through responsible pet ownership, rescue, and education.", "Manila", null],
    ["Haribon Foundation", "Environmental protection through community-based conservation programs across the Philippines.", "Quezon City", null],
  ];
  for (const o of orgs) {
    await run("INSERT INTO organizations (name, description, location, ngoId) VALUES (?, ?, ?, ?)", o);
  }
  return true;
}

async function seedCategories() {
  const { count } = await get("SELECT COUNT(*) AS count FROM categories");
  if (count > 0) return false;
  const cats = [
    "Education", "Health Care", "Environment", "Animal Welfare", "Child Protection",
    "Feeding Program", "Disaster Relief", "Community Support", "Mental Health",
    "Elderly Care", "Sustainability", "Tree Planting",
  ];
  for (const c of cats) await run("INSERT IGNORE INTO categories (name) VALUES (?)", [c]);

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
  return true;
}

async function seedEvents() {
  const { count } = await get("SELECT COUNT(*) AS count FROM events");
  if (count > 0) return false;
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
  return true;
}

async function main() {
  if (!(await tablesExist())) {
    throw new Error("Schema not found — run `npm run db:migrate` first.");
  }

  const results = {
    ngos: await seedNgos(),
    organizations: await seedOrganizations(),
    categories: await seedCategories(),
    events: await seedEvents(),
  };

  const seeded = Object.entries(results).filter(([, did]) => did).map(([k]) => k);
  const skipped = Object.entries(results).filter(([, did]) => !did).map(([k]) => k);
  if (seeded.length) console.log(`Seeded: ${seeded.join(", ")}`);
  if (skipped.length) console.log(`Already present (skipped): ${skipped.join(", ")}`);
}

main()
  .then(() => closeDb())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error("Seed failed:", err.message);
    await closeDb().catch(() => {});
    process.exit(1);
  });
