import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { prepareE2eFixtures } from "./prepare-fixtures.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const appDbPath = path.join(__dirname, ".tmp", "app.db");

await prepareE2eFixtures({ forceAppDb: true });

const child = spawn(
  path.join(rootDir, "node_modules/.bin/vite"),
  ["dev", "--host", "127.0.0.1", "--port", "3005"],
  {
    cwd: rootDir,
    stdio: "inherit",
    env: {
      ...process.env,
      DB_URL: `file:${appDbPath}`,
    },
  },
);

child.on("exit", (code) => process.exit(code ?? 0));
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
