import { KyselyPgDatabase } from "#src/db/postgres/kysely.pg.database.ts";
import { Effect } from "effect";
import { sql } from "kysely";
import type { TableRelationship } from "#src/types/relationships.ts";
import type {
	FilterConditionExpression,
	LogicalOperator,
	QueryFilterType,
} from "#src/lib/query-filter";

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
			// Build WHERE clause using Kysely's expression builder
			const buildWhereExpression = (
				conditions: FilterConditionExpression[],
				logicalOp: LogicalOperator,
			): any => {
				if (conditions.length === 0) return undefined;

				const expressions = conditions.map((condition) => {
					const colRef = sql.ref(condition.column);

					switch (condition.operator) {
						case "equals":
							return sql`${colRef} = ${condition.value}`;
						case "not_equals":
							return sql`${colRef} != ${condition.value}`;
						case "contains":
							return sql`${colRef} ILIKE ${"%" + condition.value + "%"}`;
						case "not_contains":
							return sql`${colRef} NOT ILIKE ${"%" + condition.value + "%"}`;
						case "starts_with":
							return sql`${colRef} ILIKE ${condition.value + "%"}`;
						case "ends_with":
							return sql`${colRef} ILIKE ${"%" + condition.value}`;
						case "greater_than":
							return sql`${colRef} > ${condition.value}`;
						case "greater_than_or_equal":
							return sql`${colRef} >= ${condition.value}`;
						case "less_than":
							return sql`${colRef} < ${condition.value}`;
						case "less_than_or_equal":
							return sql`${colRef} <= ${condition.value}`;
						case "is_null":
							return sql`${colRef} IS NULL`;
						case "is_not_null":
							return sql`${colRef} IS NOT NULL`;
						case "in": {
							const values = Array.isArray(condition.value)
								? condition.value
								: [condition.value];
							return sql`${colRef} = ANY(${values})`;
						}
						case "not_in": {
							const values = Array.isArray(condition.value)
								? condition.value
								: [condition.value];
							return sql`${colRef} != ALL(${values})`;
						}
						default:
							const _exhaustive: never = condition.operator;
							return _exhaustive;
					}
				});

				if (expressions.length === 0) return undefined;
				if (expressions.length === 1) return expressions[0];

				// Combine expressions with AND/OR
				if (logicalOp === "and") {
					return expressions.reduce((acc, expr) => sql`${acc} AND ${expr}`);
				} else {
					return expressions.reduce((acc, expr) => sql`${acc} OR ${expr}`);
				}
			};

			// Execute COUNT queries sequentially with Effect
			const results = yield* Effect.forEach(relationships, (rel) => {
				return Effect.gen(function* () {
					const isNullValue =
						rowData[rel.referencingColumn] === null ||
						rowData[rel.referencingColumn] === undefined;

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
										value: String(rowData[rel.referencingColumn]),
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
			});

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
