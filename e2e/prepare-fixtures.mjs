import { createClient } from "@libsql/client";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const tmpDir = path.join(__dirname, ".tmp");
const sampleDbPath = path.join(tmpDir, "sample.db");
const appDbPath = path.join(tmpDir, "app.db");
const pathsFile = path.join(tmpDir, "paths.json");
const migrationsDir = path.join(rootDir, "migrations");

async function ensureAppDb({ force = false, sampleDbPathForConnection } = {}) {
  mkdirSync(tmpDir, { recursive: true });

  if (existsSync(appDbPath) && !force) {
    // Keep seeded connection in sync with current sample db path
    if (sampleDbPathForConnection) {
      await upsertE2eConnection(sampleDbPathForConnection);
    }
    return;
  }

  try {
    unlinkSync(appDbPath);
  } catch {
    // ignore
  }

  const appClient = createClient({ url: `file:${appDbPath}` });
  const migrationFiles = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of migrationFiles) {
    const sql = readFileSync(path.join(migrationsDir, file), "utf8");
    const statements = sql
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const statement of statements) {
      await appClient.execute(statement);
    }
  }
  appClient.close();

  if (sampleDbPathForConnection) {
    await upsertE2eConnection(sampleDbPathForConnection);
  }
}

async function upsertE2eConnection(samplePath) {
  const appClient = createClient({ url: `file:${appDbPath}` });
  const now = Math.floor(Date.now() / 1000);
  const url = `file:${samplePath}`;
  await appClient.execute({
    sql: `DELETE FROM database_connections WHERE name = ?`,
    args: ["e2e-sqlite"],
  });
  await appClient.execute({
    sql: `INSERT INTO database_connections (id, dialect, url, name, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: ["e2e-sqlite-id", "sqlite", url, "e2e-sqlite", now, now],
  });
  appClient.close();
}

async function prepareSampleDb() {
  mkdirSync(tmpDir, { recursive: true });
  const sampleClient = createClient({ url: `file:${sampleDbPath}` });
  await sampleClient.execute("DROP TABLE IF EXISTS users");
  await sampleClient.execute(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      age INTEGER
    )
  `);
  await sampleClient.execute(`
    INSERT INTO users (name, email, age) VALUES
      ('Alice', 'alice@example.com', 30),
      ('Bob', 'bob@example.com', 25)
  `);
  sampleClient.close();
}

function writePaths() {
  writeFileSync(
    pathsFile,
    JSON.stringify(
      {
        sampleDbPath,
        appDbPath,
        appDbUrl: `file:${appDbPath}`,
      },
      null,
      2,
    ),
  );
}

/**
 * @param {{ forceAppDb?: boolean }} [options]
 */
export async function prepareE2eFixtures(options = {}) {
  await prepareSampleDb();
  await ensureAppDb({
    force: options.forceAppDb ?? false,
    sampleDbPathForConnection: sampleDbPath,
  });
  writePaths();
  console.log(`[e2e] prepared fixtures in ${tmpDir}`);
}

const isDirectRun =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectRun) {
  await prepareE2eFixtures({ forceAppDb: true });
}
