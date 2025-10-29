import { Effect } from "effect";
import { AppDatabase } from "./app.db.ts";
import { NanoId } from "#src/services/nano-id.ts";
import type { Insertable } from "kysely";
import type { AppDatabaseSchema } from "./app.db.schema.ts";

export class DatabaseConnectionsRepository extends Effect.Service<DatabaseConnectionsRepository>()(
	"@dadabase/db/DatabaseConnectionsRepository",
	{
		dependencies: [NanoId.Default],
		effect: Effect.gen(function* () {
			const nanoId = yield* NanoId;
			const db = yield* AppDatabase;
			return {
				findAll: () =>
					db.execute(db.selectFrom("database_connections").selectAll()),
				insert: Effect.fn(function* (
					insertable: Omit<
						Insertable<AppDatabaseSchema["database_connections"]>,
						"id"
					>,
				) {
					const id = yield* nanoId.generate("db_conn");
					return yield* db.execute(
						db.insertInto("database_connections").values({
							id,
							dialect: insertable.dialect,
							name: insertable.name,
							url: insertable.url,
							created_at: insertable.created_at,
							updated_at: insertable.updated_at,
						}),
					);
				}),
			};
		}),
	},
) {}
