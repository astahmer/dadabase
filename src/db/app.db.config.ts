import { Config, Redacted } from "effect";
import path from "node:path";

const dbFilePath = path.resolve(process.cwd(), "app.db");

export const DatabaseUrl = Config.redacted("DB_URL").pipe(
  Config.withDefault(Redacted.make(`file:${dbFilePath}`)),
);
