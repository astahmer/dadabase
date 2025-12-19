import type {
    JoinedTable,
    JoinTablesConfig,
} from "#src/components/pages/connection-page/join-tables/join-tables.types.ts";
import type { QueryFilterType } from "#src/components/query-builder/query-filter.ts";
import { DatabaseDialect } from "#src/db/dialect.ts";
import { escapeIdentifier } from "#src/server/introspection/escape-value.ts";
import { buildLimitClause, buildOrderByClause } from "./build-pagination-clause.ts";
import { buildWhereClause } from "./build-where-clause.ts";
/**
 * Generate aliases for joins to handle multiple joins on the same table
 */
export const generateJoinAliases = (
    joins: JoinedTable[],
    baseTable?: string,
    baseSchema?: string,
): Map<number, string> => {
    const aliases = new Map<number, string>();
    const userProvidedAliases = new Set<number>();
    const userProvidedTables = new Set<string>();

    for (let i = 0; i < joins.length; i++) {
        const join = joins[i];
        if (join.alias) {
            aliases.set(i, join.alias);
            userProvidedAliases.add(i);
            userProvidedTables.add(`${join.schema}.${join.table}`);
        }
    }

    const tableCountMap = new Map<string, number>();
    for (let i = 0; i < joins.length; i++) {
        if (userProvidedAliases.has(i)) continue;

        const join = joins[i];
        const tableKey = `${join.schema}.${join.table}`;
        tableCountMap.set(tableKey, (tableCountMap.get(tableKey) ?? 0) + 1);
    }

    const tablesWithDuplicates = new Set<string>();
    for (const [tableKey, count] of tableCountMap) {
        if (count > 1) {
            tablesWithDuplicates.add(tableKey);
        }
    }

    if (baseTable && baseSchema) {
        const baseTableKey = `${baseSchema}.${baseTable}`;
        const baseTableCount = tableCountMap.get(baseTableKey) ?? 0;
        if (baseTableCount > 0) {
            tablesWithDuplicates.add(baseTableKey);
        }
    }

    const tableCounterMap = new Map<string, number>();
    for (let i = 0; i < joins.length; i++) {
        if (userProvidedAliases.has(i)) continue;

        const join = joins[i];
        const tableKey = `${join.schema}.${join.table}`;

        if (tablesWithDuplicates.has(tableKey)) {
            const counter = (tableCounterMap.get(tableKey) ?? 0) + 1;
            tableCounterMap.set(tableKey, counter);
            aliases.set(i, `${join.table}_${counter}`);
        }
    }

    return aliases;
};

/**
 * Build join clause for PostgreSQL
 * Returns the join part of the SQL without the main table SELECT
 */
export const buildPostgresJoinClauses = (
    joins: JoinedTable[],
    baseTable: string,
    baseSchema: string,
    joinAliases: Map<number, string>,
): string[] => {
    return joins.map((join, i) => {
        const alias = joinAliases.get(i);
        const joinTableRef = escapeIdentifier(join.schema)
            ? `${escapeIdentifier(join.schema)}.${escapeIdentifier(join.table)}`
            : escapeIdentifier(join.table);

        const aliasClause = alias ? ` AS ${escapeIdentifier(alias)}` : "";
        const joinType = join.type === "left" ? "LEFT JOIN" : "INNER JOIN";

        let joinCondition = "";
        const condition = join.joinCondition;

        if (condition.mode === "standard") {
            const fromTable = join.joinFrom?.table || baseTable;
            const fromAlias = join.joinFrom
                ? joinAliases.values().next().value || fromTable
                : baseTable;

            joinCondition = `${escapeIdentifier(fromAlias)}.${escapeIdentifier(condition.referencingColumn)} = ${alias ? escapeIdentifier(alias) : joinTableRef}.${escapeIdentifier(condition.referencedColumn)}`;
        } else if (condition.mode === "custom") {
            // Custom join conditions are raw SQL
            joinCondition = condition.conditions.join(" AND ");
        } else if (condition.mode === "filters") {
            // Filters mode - build WHERE-like conditions
            if (condition.filters && condition.filters.conditions.length > 0) {
                const whereClause = buildWhereClause(
                    condition.filters.conditions,
                    condition.filters.logicalOperator,
                    DatabaseDialect.Postgres,
                    join.schema,
                    join.table,
                );
                joinCondition = whereClause;
            }
        }

        return `${joinType} ${joinTableRef}${aliasClause} ON ${joinCondition}`;
    });
};

/**
 * Build join clause for SQLite
 */
export const buildSqliteJoinClauses = (
    joins: JoinedTable[],
    baseTable: string,
    joinAliases: Map<number, string>,
): string[] => {
    return joins.map((join, i) => {
        const alias = joinAliases.get(i);
        const joinTableRef = escapeIdentifier(join.table);

        const aliasClause = alias ? ` AS ${escapeIdentifier(alias)}` : "";
        const joinType = join.type === "left" ? "LEFT JOIN" : "INNER JOIN";

        let joinCondition = "";
        const condition = join.joinCondition;

        if (condition.mode === "standard") {
            const fromTable = join.joinFrom?.table || baseTable;
            const fromAlias = join.joinFrom
                ? joinAliases.values().next().value || fromTable
                : baseTable;

            joinCondition = `${escapeIdentifier(fromAlias)}.${escapeIdentifier(condition.referencingColumn)} = ${alias ? escapeIdentifier(alias) : joinTableRef}.${escapeIdentifier(condition.referencedColumn)}`;
        } else if (condition.mode === "custom") {
            joinCondition = condition.conditions.join(" AND ");
        } else if (condition.mode === "filters") {
            if (condition.filters && condition.filters.conditions.length > 0) {
                const whereClause = buildWhereClause(
                    condition.filters.conditions,
                    condition.filters.logicalOperator,
                    DatabaseDialect.SQLite,
                    undefined,
                    join.table,
                );
                joinCondition = whereClause;
            }
        }

        return `${joinType} ${joinTableRef}${aliasClause} ON ${joinCondition}`;
    });
};

/**
 * Build complete SQL SELECT query for table data
 * Shared between frontend preview and backend execution
 */
export interface BuildQuerySqlInput {
    schema: string;
    table: string;
    limit?: number;
    offset?: number;
    orderBy?: string;
    orderDirection?: "asc" | "desc";
    nullsOrder?: "first" | "last";
    filters?: QueryFilterType;
    joins?: JoinTablesConfig["joins"];
    selectedColumns?: string[];
    excludedColumns?: string[];
}

export interface QuerySqlResult {
    sql: string;
    /** Query with formatted indentation for display */
    formattedSql: string;
}

/**
 * Build a SELECT query SQL string (without executing)
 * Works for both PostgreSQL and SQLite
 */
export const buildQuerySql = (
    input: BuildQuerySqlInput,
    dialect: DatabaseDialect,
): QuerySqlResult => {
    const {
        schema = "public",
        table,
        limit = 50,
        offset = 0,
        orderBy,
        orderDirection = "asc",
        nullsOrder,
        filters,
        joins = [],
        selectedColumns = [],
        excludedColumns = [],
    } = input;

    // For demonstration: build a simple SQL query
    // In reality, this would be much more complex with proper column selection, etc.
    const whereClause =
        filters && filters.conditions.length > 0
            ? buildWhereClause(filters.conditions, filters.logicalOperator, dialect, schema, table)
            : "";

    const orderClause = buildOrderByClause(orderBy, orderDirection, nullsOrder);
    const limitClause = buildLimitClause(limit, offset);

    const joinClauses =
        joins.length > 0
            ? dialect === "postgres"
                ? buildPostgresJoinClauses(joins, table, schema, generateJoinAliases(joins, table, schema))
                : buildSqliteJoinClauses(joins, table, generateJoinAliases(joins, table, schema))
            : [];

    // Build SELECT clause
    let selectClause = "*";
    if (selectedColumns && selectedColumns.length > 0) {
        selectClause = selectedColumns.join(", ");
    } else if (excludedColumns && excludedColumns.length > 0) {
        // For excluded columns, we'd need to know all columns - for now just use *
        // In the actual server function this is handled properly
        selectClause = "*";
    }

    // Build the query
    const fromClause =
        dialect === "postgres"
            ? `FROM ${escapeIdentifier(schema)}.${escapeIdentifier(table)}`
            : `FROM ${escapeIdentifier(table)}`;

    const sqlParts = [
        `SELECT ${selectClause}`,
        fromClause,
        ...joinClauses,
        whereClause && `WHERE ${whereClause}`,
        orderClause,
        limitClause,
    ].filter(Boolean);

    const sql = sqlParts.join(" ");

    // Format for display
    const formattedSql = sqlParts.join("\n");

    return { sql, formattedSql };
};
