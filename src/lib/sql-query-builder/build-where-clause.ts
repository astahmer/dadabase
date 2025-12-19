import type {
    LogicalOperatorType,
    QueryFilterType,
} from "#src/components/query-builder/query-filter.ts";
import type { DatabaseDialect } from "#src/db/dialect.ts";
import { escapeIdentifier, escapeValue } from "./sql-escape.ts";

/**
 * Build a WHERE clause fragment for SQL queries (PostgreSQL specific)
 * Returns the WHERE clause without the "WHERE" keyword
 */
export const buildPostgresWhereClause = (
    conditions: QueryFilterType["conditions"],
    logicalOp: LogicalOperatorType,
    schema?: string,
    table?: string,
): string | undefined => {
    if (conditions.length === 0) return;

    const validConditions = conditions.filter((c) => {
        if (c.operator === "is_null" || c.operator === "is_not_null") return true;
        return c.value !== undefined && c.value !== null;
    });

    if (validConditions.length === 0) return;

    const expressions = validConditions.map((c) => {
        let col: string;
        if (c.table) {
            col = `${escapeIdentifier(c.table)}.${escapeIdentifier(c.column)}`;
        } else if (schema && table) {
            col = `${escapeIdentifier(schema)}.${escapeIdentifier(table)}.${escapeIdentifier(c.column)}`;
        } else {
            col = `${escapeIdentifier(c.column)}`;
        }

        switch (c.operator) {
            case "equals":
                return `${col} = '${escapeValue(c.value)}'`;
            case "not_equals":
                return `${col} != '${escapeValue(c.value)}'`;
            case "contains":
                return `${col} ILIKE '%${escapeValue(c.value)}%'`;
            case "not_contains":
                return `${col} NOT ILIKE '%${escapeValue(c.value)}%'`;
            case "starts_with":
                return `${col} ILIKE '${escapeValue(c.value)}%'`;
            case "ends_with":
                return `${col} ILIKE '%${escapeValue(c.value)}'`;
            case "greater_than":
                return `${col} > '${escapeValue(c.value)}'`;
            case "greater_than_or_equal":
                return `${col} >= '${escapeValue(c.value)}'`;
            case "less_than":
                return `${col} < '${escapeValue(c.value)}'`;
            case "less_than_or_equal":
                return `${col} <= '${escapeValue(c.value)}'`;
            case "is_null":
                return `${col} IS NULL`;
            case "is_not_null":
                return `${col} IS NOT NULL`;
            case "in": {
                const values = Array.isArray(c.value) ? c.value : [c.value];
                return `${col} = ANY(ARRAY[${values.map((v) => `'${escapeValue(v)}'`).join(",")}])`;
            }
            case "not_in": {
                const values = Array.isArray(c.value) ? c.value : [c.value];
                return `${col} != ALL(ARRAY[${values.map((v) => `'${escapeValue(v)}'`).join(",")}])`;
            }
            default:
                return;
        }
    });

    const joiner = logicalOp === "and" ? " AND " : " OR ";
    return expressions.filter(Boolean).join(joiner);
};

/**
 * Build a WHERE clause fragment for SQL queries (SQLite specific)
 * Returns the WHERE clause without the "WHERE" keyword
 */
export const buildSqliteWhereClause = (
    conditions: QueryFilterType["conditions"],
    logicalOp: LogicalOperatorType,
    table?: string,
): string => {
    if (conditions.length === 0) return "";

    const validConditions = conditions.filter((c) => {
        if (c.operator === "is_null" || c.operator === "is_not_null") return true;
        return c.value !== undefined && c.value !== null;
    });

    if (validConditions.length === 0) return "";

    const expressions = validConditions.map((c) => {
        let col: string;
        if (c.table) {
            col = `${escapeIdentifier(c.table)}.${escapeIdentifier(c.column)}`;
        } else if (table) {
            col = `${escapeIdentifier(table)}.${escapeIdentifier(c.column)}`;
        } else {
            col = `${escapeIdentifier(c.column)}`;
        }

        const sqliteValue =
            typeof c.value === "boolean" ? (c.value ? 1 : 0) : c.value;
        const formatValue = (val: any): string => {
            if (typeof val === "number") return String(val);
            return `'${escapeValue(val)}'`;
        };

        switch (c.operator) {
            case "equals":
                return `${col} = ${formatValue(sqliteValue)}`;
            case "not_equals":
                return `${col} != ${formatValue(sqliteValue)}`;
            case "contains":
                return `${col} LIKE '%${escapeValue(sqliteValue)}%' COLLATE NOCASE`;
            case "not_contains":
                return `${col} NOT LIKE '%${escapeValue(sqliteValue)}%' COLLATE NOCASE`;
            case "starts_with":
                return `${col} LIKE '${escapeValue(sqliteValue)}%' COLLATE NOCASE`;
            case "ends_with":
                return `${col} LIKE '%${escapeValue(sqliteValue)}' COLLATE NOCASE`;
            case "greater_than":
                return `${col} > ${formatValue(sqliteValue)}`;
            case "greater_than_or_equal":
                return `${col} >= ${formatValue(sqliteValue)}`;
            case "less_than":
                return `${col} < ${formatValue(sqliteValue)}`;
            case "less_than_or_equal":
                return `${col} <= ${formatValue(sqliteValue)}`;
            case "is_null":
                return `${col} IS NULL`;
            case "is_not_null":
                return `${col} IS NOT NULL`;
            case "in": {
                const values = Array.isArray(c.value) ? c.value : [c.value];
                const sqliteValues = values.map((v) =>
                    typeof v === "boolean" ? (v ? 1 : 0) : v,
                );
                return `${col} IN (${sqliteValues.map((v) => formatValue(v)).join(",")})`;
            }
            case "not_in": {
                const values = Array.isArray(c.value) ? c.value : [c.value];
                const sqliteValues = values.map((v) =>
                    typeof v === "boolean" ? (v ? 1 : 0) : v,
                );
                return `${col} NOT IN (${sqliteValues.map((v) => formatValue(v)).join(",")})`;
            }
            default:
                return "";
        }
    });

    const joiner = logicalOp === "and" ? " AND " : " OR ";
    return expressions.filter(Boolean).join(joiner);
};

/**
 * Dialect-agnostic WHERE clause builder that delegates to specific dialect implementations
 */
export const buildWhereClause = (
    conditions: QueryFilterType["conditions"],
    logicalOp: LogicalOperatorType,
    dialect: DatabaseDialect,
    schema?: string,
    table?: string,
): string => {
    if (dialect === "postgres") {
        return buildPostgresWhereClause(conditions, logicalOp, schema, table) ?? "";
    } else if (dialect === "sqlite") {
        return buildSqliteWhereClause(conditions, logicalOp, table) ?? "";
    }
    return "";
};
