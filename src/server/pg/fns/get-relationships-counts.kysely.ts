import { KyselyPgDatabase } from "#src/db/postgres/kysely.pg.database.ts";
import { Effect } from "effect";
import { sql } from "kysely";
import type { TableRelationship } from "#src/components/pages/connection-page/relationships/relationships.ts";
import type { QueryFilterType } from "#src/components/query-builder/query-filter.ts";
import { buildWhereExpression } from "./build-where-expression";
import { withQueryLogging } from "#src/server/query-logger/with-query-logging.ts";
import {
	persistQueryLog,
	updatePersistedQueryLog,
} from "#src/server/query-logger/query-logger.kysely.ts";

export interface RelationshipCountResult {
	constraintName: string;
	count: number;
}

/**
 * Fetch row counts for all relationships of a table in a single batch
 * This is more efficient than querying each relationship individually
 */
export const getRelationshipsCounts = (input: {
	schema: string;
	table: string;
	relationships: TableRelationship[];
	rowData: Record<string, unknown>;
	connectionId: string;
}) =>
	Effect.gen(function* () {
		const db = yield* KyselyPgDatabase;
		const { schema, table, relationships, rowData, connectionId } = input;

		if (relationships.length === 0) {
			return {};
		}

		try {
			// Filter out relationships where the FK value is null
			const validRelationships = relationships.filter((rel) => {
				const filterValue =
					rowData[
						rel.type === "incoming"
							? rel.referencedColumn
							: rel.referencingColumn
					];
				const isNullValue =
					filterValue === null ||
					filterValue === undefined ||
					filterValue === "null";
				return !isNullValue;
			});

			// Execute COUNT queries sequentially with Effect
			const results = yield* Effect.forEach(
				validRelationships,
				(rel) => {
					return Effect.gen(function* () {
						const filterValue =
							rowData[
								rel.type === "incoming"
									? rel.referencedColumn
									: rel.referencingColumn
							];

						const filter: QueryFilterType = {
							conditions: [
								{
									column: rel.referencingColumn,
									operator: "equals" as const,
									value: String(filterValue),
								},
							],
							logicalOperator: "and" as const,
						};

						const whereExpression = buildWhereExpression(
							Array.from(filter.conditions),
							filter.logicalOperator,
						);

						let countQuery = db
							.selectFrom(
								`${rel.referencingSchema}.${rel.referencingTable}` as any,
							)
							.select(sql`COUNT(*)::bigint`.as("count"));

						if (whereExpression) {
							countQuery = countQuery.where(whereExpression as any);
						}

						const countSql = countQuery.compile().sql;
						const result = yield* withQueryLogging(
							db.execute(countQuery as any),
							{
								type: "constraint" as const,
								sql: countSql,
								schema: rel.referencingSchema,
								table: rel.referencingTable,
								connectionId,
								persistFn: persistQueryLog,
								updatePersistFn: updatePersistedQueryLog,
							},
						);

						const count = (result[0] as any)?.count ?? 0;
						return {
							constraintName: rel.constraintName,
							count: typeof count === "string" ? Number(count) : count,
						};
					});
				},
				{ concurrency: "unbounded" },
			);

			const counts = results;

			// Convert array to object keyed by constraintName
			const result: Record<string, number> = {};
			for (const { constraintName, count } of counts) {
				result[constraintName] = count;
			}

			return result;
		} catch (error) {
			console.error(
				`Error fetching relationship counts for ${schema}.${table}:`,
				error,
			);
			// Return empty object on error
			return {};
		}
	});
