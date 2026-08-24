import type { Selectable } from "kysely";

import type { AppDatabaseSchema } from "#src/db/app.db.schema.ts";

export type DbConnection = Selectable<AppDatabaseSchema["database_connections"]>;
