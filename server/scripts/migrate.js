/**
 * db:migrate — apply pending migrations from src/migrations/.
 *
 * Each migration file (NNN_name.js) exports `async up({ run, all, get })`.
 * Applied versions are recorded in the `schema_migrations` table so each runs
 * exactly once. Run this as a deploy step BEFORE starting the app.
 *
 * Usage: npm run db:migrate
 */
import { fileURLToPath, pathToFileURL } from "url";
import { dirname, join } from "path";
import { readdir } from "fs/promises";
import { run, all, get, closeDb } from "../src/db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "..", "src", "migrations");

async function ensureMigrationsTable() {
  await run(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      appliedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `);
}

async function main() {
  await ensureMigrationsTable();

  const appliedRows = await all("SELECT version FROM schema_migrations");
  const applied = new Set(appliedRows.map((r) => r.version));

  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith(".js")).sort();

  let count = 0;
  for (const file of files) {
    const version = file.replace(/\.js$/, "");
    if (applied.has(version)) continue;

    const mod = await import(pathToFileURL(join(migrationsDir, file)).href);
    if (typeof mod.up !== "function") {
      throw new Error(`Migration ${file} does not export an 'up' function`);
    }

    process.stdout.write(`→ applying ${version} ... `);
    await mod.up({ run, all, get });
    await run("INSERT INTO schema_migrations (version) VALUES (?)", [version]);
    console.log("done");
    count++;
  }

  console.log(count ? `Applied ${count} migration(s).` : "Already up to date.");
}

main()
  .then(() => closeDb())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error("Migration failed:", err.message);
    await closeDb().catch(() => {});
    process.exit(1);
  });
