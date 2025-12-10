import path from "node:path";
import { Config, Redacted } from "effect";

// @ts-expect-error drizle-kit wont work with the line below but node does
if (typeof __dirname === "undefined") {
	var __dirname = new URL(".", import.meta.url).pathname;
}
const dbFilePath = path.resolve(path.join(__dirname, "../../app.db"));

export const DatabaseUrl = Config.redacted("DB_URL").pipe(
	Config.withDefault(Redacted.make(dbFilePath)),
);
