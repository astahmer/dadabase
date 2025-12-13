import type {
	FilterConditionExpression,
	QueryFilterType,
} from "#src/components/query-builder/query-filter.ts";
import type { JoinedTable } from "#src/components/pages/connection-page/join-tables/join-tables.types.ts";

/**
 * Build a WHERE expression from filter conditions for preview purposes
 * This is a simplified version that works on the frontend
 */
function buildFilterExpression(
	conditions: FilterConditionExpression[],
	logicalOperator: "and" | "or",
	schema: string,
	table: string,
): string {
	const validConditions = conditions.filter(
		(cond) => cond.column && cond.value !== "",
	);

	if (validConditions.length === 0) return "";

	const expressions = validConditions.map((cond) => {
		const column = `"${schema}"."${table}"."${cond.column}"`;
		const value =
			cond.value === null || cond.value === undefined
				? "NULL"
				: `'${cond.value}'`;

		switch (cond.operator) {
			case "equals":
				return `${column} = ${value}`;
			case "not_equals":
				return `${column} != ${value}`;
			case "contains":
				return `${column} ILIKE '%${cond.value}%'`;
			case "not_contains":
				return `${column} NOT ILIKE '%${cond.value}%'`;
			case "starts_with":
				return `${column} ILIKE '${cond.value}%'`;
			case "ends_with":
				return `${column} ILIKE '%${cond.value}'`;
			case "greater_than":
				return `${column} > '${cond.value}'`;
			case "less_than":
				return `${column} < '${cond.value}'`;
			case "greater_than_or_equal":
				return `${column} >= '${cond.value}'`;
			case "less_than_or_equal":
				return `${column} <= '${cond.value}'`;
			case "is_null":
				return `${column} IS NULL`;
			case "is_not_null":
				return `${column} IS NOT NULL`;
			case "in":
				const values = Array.isArray(cond.value)
					? cond.value.map((v) => `'${v}'`).join(", ")
					: `'${cond.value}'`;
				return `${column} = ANY(ARRAY[${values}])`;
			default:
				return "";
		}
	});

	const validExpressions = expressions.filter(Boolean);
	if (validExpressions.length === 0) return "";

	return `(${validExpressions.join(` ${logicalOperator.toUpperCase()} `)})`;
}

/**
 * Build JOIN clause SQL for preview purposes
 */
function buildJoinClause(
	join: JoinedTable,
	schema: string,
	table: string,
	dialect: "postgres" | "sqlite" = "postgres",
): string {
	const joinType = join.type === "left" ? "LEFT JOIN" : "INNER JOIN";
	const schemaPrefix = dialect === "postgres" ? `${join.schema}.` : "";
	let joinCondition: string;

	if (join.joinCondition.mode === "standard") {
		if (dialect === "postgres") {
			joinCondition = `${join.schema}."${join.table}"."${join.joinCondition.referencedColumn}" = ${schema}."${table}"."${join.joinCondition.referencingColumn}"`;
		} else {
			joinCondition = `${join.table}."${join.joinCondition.referencedColumn}" = ${schema}."${table}"."${join.joinCondition.referencingColumn}"`;
		}
	} else if (join.joinCondition.mode === "custom") {
		const conditions = join.joinCondition.conditions
			.filter((cond) => cond && cond.trim().length > 0)
			.map((cond) => cond.trim());
		joinCondition =
			conditions.length > 0
				? conditions.join(" AND ")
				: dialect === "postgres"
					? `${join.schema}."${join.table}"."${join.joinCondition.referencedColumn}" = ${schema}."${table}"."${join.joinCondition.referencingColumn}"`
					: `${join.table}."${join.joinCondition.referencedColumn}" = ${schema}."${table}"."${join.joinCondition.referencingColumn}"`;
	} else {
		// Filter-based join conditions
		const fkCondition =
			dialect === "postgres"
				? `${join.schema}."${join.table}"."${join.joinCondition.referencedColumn}" = ${schema}."${table}"."${join.joinCondition.referencingColumn}"`
				: `${join.table}."${join.joinCondition.referencedColumn}" = ${schema}."${table}"."${join.joinCondition.referencingColumn}"`;

		if (
			!join.joinCondition.filters ||
			join.joinCondition.filters.conditions.length === 0
		) {
			joinCondition = fkCondition;
		} else {
			const filterExpression = buildFilterExpression(
				join.joinCondition.filters.conditions,
				join.joinCondition.filters.logicalOperator,
				join.schema,
				join.table,
			);
			joinCondition = filterExpression
				? `${fkCondition} AND ${filterExpression}`
				: fkCondition;
		}
	}

	return `${joinType} ${schemaPrefix}"${join.table}" ON ${joinCondition}`;
}

/**
 * Generate a preview SQL SELECT statement showing the configured joins
 * Useful for previewing what data will be returned
 */
export function buildJoinSqlPreview(
	schema: string,
	table: string,
	joins: JoinedTable[],
	dialect: "postgres" | "sqlite" = "postgres",
): string {
	const schemaPrefix = dialect === "postgres" ? `${schema}.` : "";
	const lines: string[] = [];

	// SELECT clause - show table names being joined
	const tableNames = [table, ...joins.map((j) => j.table)];
	lines.push(
		`SELECT ${schemaPrefix}"${table}".*${joins.length > 0 ? ", " : ""}${joins.map((j) => `${schemaPrefix}"${j.table}".*`).join(", ")}`,
	);

	// FROM clause
	lines.push(`FROM ${schemaPrefix}"${table}"`);

	// JOIN clauses
	if (joins.length > 0) {
		joins.forEach((join) => {
			lines.push(buildJoinClause(join, schema, table, dialect));
		});
	}

	// Add limit and offset hints
	lines.push("LIMIT 50 OFFSET 0");

	return lines.join("\n");
}

/**
 * Generate a simplified summary of joins for display
 * Shows just the essential information for quick preview
 */
export function buildJoinSummary(joins: JoinedTable[]): string {
	if (joins.length === 0) return "No joins configured";

	return joins
		.map((join, i) => {
			const joinType = join.type === "left" ? "LEFT" : "INNER";
			let condition = "standard FK";

			if (join.joinCondition.mode === "custom") {
				const count = join.joinCondition.conditions.filter(
					(c) => c.trim().length > 0,
				).length;
				condition = `custom (${count} condition${count !== 1 ? "s" : ""})`;
			} else if (join.joinCondition.mode === "filters") {
				const count = join.joinCondition.filters?.conditions.length || 0;
				condition = `filters (${count} condition${count !== 1 ? "s" : ""})`;
			}

			return `${i + 1}. ${join.schema}.${join.table} [${joinType} ${condition}]`;
		})
		.join("\n");
}
