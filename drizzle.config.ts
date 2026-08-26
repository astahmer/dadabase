import type { Config as DrizzleConfig } from "drizzle-kit";

import path from "node:path";

// @ts-expect-error drizle-kit wont work with the line below but node does
if (typeof __dirname === "undefined") {
  var __dirname = new URL(".", import.meta.url).pathname;
}
const dbFilePath = path.resolve(path.join(__dirname, "./app.db"));

const dbUrl = process.env.DB_URL ?? `file:${dbFilePath}`;

const drizzleConfig = {
  dialect: "sqlite",
  schema: path.resolve(process.cwd(), "./src/db/app.db.schema.ts"),
  out: "./migrations",
  verbose: true,
  dbCredentials: {
    url: dbUrl,
  },
} satisfies DrizzleConfig;

export default drizzleConfig;
