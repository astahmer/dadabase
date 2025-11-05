import { KyselyPgDatabase } from "#src/db/postgres/kysely.pg.database.ts";
import { SqlError } from "@effect/sql";
import { Effect } from "effect";
import { sql } from "kysely";
import type {
	FilterConditionExpression,
	LogicalOperator,
} from "#src/lib/query-filter";

export const queryTableData = (input: {
	schema: string;
	table: string;
	limit?: number;
	offset?: number;
	orderBy?: string;
	orderDirection?: "asc" | "desc";
	filters?: {
		conditions: FilterConditionExpression[];
		logicalOperator: LogicalOperator;
	};
}) =>
	Effect.gen(function* () {
		const db = yield* KyselyPgDatabase;
		const limit = input.limit ?? 50;
		const offset = input.offset ?? 0;
		const orderBy = input.orderBy;
		const orderDirection = input.orderDirection ?? "asc";
		const filterConfig = input.filters;

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

			const whereExpression = filterConfig
				? buildWhereExpression(
						filterConfig.conditions,
						filterConfig.logicalOperator,
					)
				: undefined;

			// Get total count
			let countQuery = db
				.selectFrom(`${input.schema}.${input.table}` as any)
				.select(sql`COUNT(*)::bigint`.as("count"));

			if (whereExpression) {
				countQuery = countQuery.where(whereExpression as any);
			}

			// console.log("Count SQL:", countQuery.compile().sql);
			const countResult = yield* db.execute(countQuery as any);
			const rowCount = (countResult[0] as any)?.count ?? 0;

			// Build the main query
			let query = db
				.selectFrom(`${input.schema}.${input.table}` as any)
				.selectAll();

			if (whereExpression) {
				query = query.where(whereExpression as any);
			}

			// Add ordering if specified
			if (orderBy) {
				query = query.orderBy(sql.ref(orderBy) as any);
				if (orderDirection === "desc") {
					query = query.orderBy(sql`${sql.ref(orderBy)} DESC` as any);
				}
			}

			// Add limit and offset for pagination
			query = query.limit(limit).offset(offset);

			// console.log("Main SQL:", query.compile().sql);
			const rows = yield* db.execute(query as any);
			return { rows, rowCount };
		} catch (e) {
			return yield* Effect.fail(
				new SqlError.SqlError({
					cause: e,
					message: `Couldn't query table ${input.schema}.${input.table}`,
				}),
			);
		}
	});
