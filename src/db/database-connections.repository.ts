import { Effect } from "effect";
import { AppDatabase } from "./app.db.ts";
import type { Insertable } from "kysely";
import type { AppDatabaseSchema } from "./app.db.schema.ts";

export class DatabaseConnectionsRepository extends Effect.Service<DatabaseConnectionsRepository>()(
	"@dadabase/db/DatabaseConnectionsRepository",
	{
		dependencies: [],
		effect: Effect.gen(function* () {
			const db = yield* AppDatabase;
			return {
				findAll: () => {
					return db.execute(
						db
							.selectFrom("database_connections")
							.selectAll()
							.where("id", "is not", null),
					);
				},
				insert: Effect.fn(function* (
					insertable: Insertable<AppDatabaseSchema["database_connections"]>,
				) {
					return yield* db.execute(
						db.insertInto("database_connections").values({
							id: insertable.id,
							dialect: insertable.dialect,
							name: insertable.name,
							url: insertable.url,
							created_at: insertable.created_at,
							updated_at: insertable.updated_at,
						}),
					);
				}),
				update: Effect.fn(function* (input: {
					id: string;
					name: string;
					url: string;
				}) {
					return yield* db.execute(
						db
							.updateTable("database_connections")
							.set({
								name: input.name,
								url: input.url,
								updated_at: new Date().getTime(),
							})
							.where("id", "=", input.id),
					);
				}),
				delete: Effect.fn(function* (input: { id: string }) {
					return yield* db.execute(
						db.deleteFrom("database_connections").where("id", "=", input.id),
					);
				}),
			};
		}),
	},
) {}
