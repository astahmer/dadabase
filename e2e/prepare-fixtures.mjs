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

  const connections = [
    { id: "e2e-sqlite-id", name: "e2e-sqlite", url: `file:${samplePath}` },
    // Shares the same underlying file, marked read-only via the `dadabase_readonly` query
    // param so the read-only mutation guard can be exercised end-to-end.
    {
      id: "e2e-sqlite-readonly-id",
      name: "e2e-sqlite-readonly",
      url: `file:${samplePath}?dadabase_readonly=1`,
    },
  ];

  for (const conn of connections) {
    await appClient.execute({
      sql: `DELETE FROM database_connections WHERE name = ?`,
      args: [conn.name],
    });
    await appClient.execute({
      sql: `INSERT INTO database_connections (id, dialect, url, name, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [conn.id, "sqlite", conn.url, conn.name, now, now],
    });
  }
  appClient.close();
}

async function prepareSampleDb() {
  mkdirSync(tmpDir, { recursive: true });
  const sampleClient = createClient({ url: `file:${sampleDbPath}` });

  await sampleClient.execute("DROP TABLE IF EXISTS posts");
  await sampleClient.execute("DROP TABLE IF EXISTS favorites");
  await sampleClient.execute("DROP TABLE IF EXISTS memberships");
  await sampleClient.execute("DROP TABLE IF EXISTS notes");
  await sampleClient.execute("DROP TABLE IF EXISTS users");
  await sampleClient.execute("DROP TABLE IF EXISTS no_pk_items");

  await sampleClient.execute(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      age INTEGER,
      active INTEGER NOT NULL DEFAULT 1
    )
  `);
  await sampleClient.execute(`
    INSERT INTO users (name, email, age, active) VALUES
      ('Alice', 'alice@example.com', 30, 1),
      ('Bob', 'bob@example.com', 25, 1),
      ('Charlie', 'charlie@example.com', 35, 0)
  `);

  await sampleClient.execute(`
    CREATE TABLE posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      body TEXT
    )
  `);
  await sampleClient.execute(`
    INSERT INTO posts (user_id, title, body) VALUES
      (1, 'Hello', 'First post'),
      (2, 'World', 'Second post')
  `);

  await sampleClient.execute(`
    CREATE TABLE favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      label TEXT NOT NULL
    )
  `);
  await sampleClient.execute(`
    INSERT INTO favorites (user_id, label) VALUES
      (3, 'star')
  `);

  await sampleClient.execute(`
    CREATE TABLE memberships (
      org_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      PRIMARY KEY (org_id, user_id)
    )
  `);
  await sampleClient.execute(`
    INSERT INTO memberships (org_id, user_id, role) VALUES
      (1, 1, 'admin'),
      (1, 2, 'member')
  `);

  await sampleClient.execute(`
    CREATE TABLE notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      payload TEXT NOT NULL
    )
  `);
  await sampleClient.execute(`
    INSERT INTO notes (title, payload) VALUES
      ('meta', '{"color":"blue","count":1}')
  `);

  await sampleClient.execute(`
    CREATE TABLE no_pk_items (
      label TEXT NOT NULL,
      value TEXT
    )
  `);
  await sampleClient.execute(`
    INSERT INTO no_pk_items (label, value) VALUES
      ('alpha', '1'),
      ('beta', '2')
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
