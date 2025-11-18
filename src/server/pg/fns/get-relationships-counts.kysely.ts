import { KyselyPgDatabase } from "#src/db/postgres/kysely.pg.database.ts";
import { Effect } from "effect";
import { sql } from "kysely";
import type { TableRelationship } from "#src/types/relationships.ts";
import type { QueryFilterType } from "#src/lib/query-filter";
import { buildWhereExpression } from "./build-where-expression";

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
}) =>
	Effect.gen(function* () {
		const db = yield* KyselyPgDatabase;
		const { schema, table, relationships, rowData } = input;

		if (relationships.length === 0) {
			return {};
		}

		try {
			// Execute COUNT queries sequentially with Effect
			const results = yield* Effect.forEach(
				relationships,
				(rel) => {
					return Effect.gen(function* () {
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

						const filter: QueryFilterType = isNullValue
							? {
									conditions: [
										{
											column: rel.referencingColumn,
											operator: "is_null" as const,
										},
									],
									logicalOperator: "and" as const,
								}
							: {
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

						const result = yield* db.execute(countQuery as any);

						return {
							constraintName: rel.constraintName,
							count: (result[0] as any)?.count ?? 0,
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
