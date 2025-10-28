import type { Kyselify } from "drizzle-orm/kysely";
import type * as pg_catalog from "./postgres/catalog.schema.ts";
import type * as information_schema from "./postgres/information.schema.ts";

export interface KyselyDbSchema {
	"pg_catalog.pg_namespace": Kyselify<typeof pg_catalog.pg_namespace>;
	"pg_catalog.pg_type": Kyselify<typeof pg_catalog.pg_type>;
	"pg_catalog.pg_database": Kyselify<typeof pg_catalog.pg_database>;

	"information_schema.tables": Kyselify<typeof information_schema.tables>;
	"information_schema.columns": Kyselify<typeof information_schema.columns>;
	"information_schema.constraints": Kyselify<
		typeof information_schema.constraints
	>;
	"information_schema.constraint_column_usage": Kyselify<
		typeof information_schema.constraint_column_usage
	>;
	"information_schema.key_column_usage": Kyselify<
		typeof information_schema.key_column_usage
	>;
}
