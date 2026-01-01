import { Effect } from "effect";
import type { Insertable, Updateable } from "kysely";
import type { AppDatabaseSchema } from "./app.db.schema.ts";
import { AppDatabase } from "./app.db.ts";
import type { EffectKysely } from "./effect-kysely.ts";

export class CustomSqlExecutionRepository extends Effect.Service<CustomSqlExecutionRepository>()(
	"@dadabase/db/CustomSqlExecutionRepository",
	{
		dependencies: [],
		effect: Effect.gen(function* () {
			const db = (yield* AppDatabase) as EffectKysely<AppDatabaseSchema>;
			return {
				findById: Effect.fn(function* (id: string) {
					const results = yield* db.execute(
						db
							.selectFrom("custom_sql_executions")
							.selectAll()
							.where("id", "=", id),
					);

					return results.length > 0 ? results[0] : null;
				}),
				findByConnectionId: Effect.fn(function* (connectionId: string) {
					return yield* db.execute(
						db
							.selectFrom("custom_sql_executions")
							.selectAll()
							.where("connection_id", "=", connectionId)
							.orderBy("started_at", "desc"),
					);
				}),
				insert: Effect.fn(function* (
					insertable: Insertable<AppDatabaseSchema["custom_sql_executions"]>,
				) {
					yield* db.execute(
						db.insertInto("custom_sql_executions").values({
							id: insertable.id,
							connection_id: insertable.connection_id,
							schema_name: insertable.schema_name,
							table_name: insertable.table_name,
							sql: insertable.sql,
							status: insertable.status,
							rows_returned: insertable.rows_returned,
							rows_affected: insertable.rows_affected,
							columns: insertable.columns,
							error_message: insertable.error_message,
							started_at: insertable.started_at,
							ended_at: insertable.ended_at,
							time_taken: insertable.time_taken,
							created_at: insertable.created_at,
						}),
					);
					return insertable.id;
				}),
				update: Effect.fn(function* (input: {
					id: string;
					updates: Updateable<AppDatabaseSchema["custom_sql_executions"]>;
				}) {
					return yield* db.execute(
						db
							.updateTable("custom_sql_executions")
							.set(input.updates)
							.where("id", "=", input.id),
					);
				}),
				delete: Effect.fn(function* (input: { id: string }) {
					return yield* db.execute(
						db.deleteFrom("custom_sql_executions").where("id", "=", input.id),
					);
				}),
			};
		}),
	},
) {}
