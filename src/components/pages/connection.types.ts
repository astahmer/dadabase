import type { AppDatabaseSchema } from "#src/db/app.db.schema.ts";
import type { Selectable } from "kysely";

export type DbConnection = Selectable<AppDatabaseSchema["database_connections"]>;
