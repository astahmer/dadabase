import { Effect, Option } from "effect";
import { SqlClient } from "effect/unstable/sql";

import type { JoinTablesConfig } from "#src/components/pages/connection-page/join-tables/join-tables.types.ts";
import type { TableRelationship } from "#src/components/pages/connection-page/relationships/relationships.ts";
import type { QueryFilterType } from "#src/components/query-builder/query-filter.ts";

import { DatabaseDialect, getDialectDefaultSchema } from "#src/db/dialect.ts";
import { SqlError } from "#src/db/effect-compat.ts";
import { parseClickhouseEnumValues } from "#src/server/db-connection/clickhouse/clickhouse-client.ts";
import {
  ALL_TABLES_INTROSPECTION_CONCURRENCY,
  pgSqliteHandlers,
} from "#src/server/introspection/pg-sqlite-handlers.ts";

import type { QueryLogger } from "../query-logger/query-logger.ts";
import type { TableRelationshipInput } from "./connection-adapter.ts";

import { RemoteConnection, RemoteDialect } from "../db-connection/remote-connection.tag.ts";
import { QueryLogLevel, QueryLogType } from "../query-logger/query-logger.types.ts";
import { withQueryLogging } from "../query-logger/with-query-logging.ts";
import { isSelectQuery } from "./detect-destructive-sql.ts";
import { fetchDuckDbForeignKeys } from "./fns/duckdb-foreign-keys.ts";
import { buildMssqlSystemRowIdSelect } from "./fns/mssql-row-fingerprint.ts";
import { buildMysqlSystemRowIdSelect } from "./fns/mysql-row-fingerprint.ts";
import { DADABASE_ROW_ID } from "./fns/row-identity.ts";
import {
  buildJoinSqlClauses,
  buildMysqlSelectWithJoins,
  buildPgSelectWithJoins,
  buildSqliteSelectWithJoins,
  generateJoinAliases,
} from "./join-builder.ts";
import {
  buildColumnList,
  buildTableColumnsMap,
  formatSchemaTable,
  remapJoins,
  remapSchema,
} from "./query-table-rows.helpers.ts";
import { buildWhereClauseWithJoins } from "./sql-query-builder/build-query-sql.ts";

/**
 * Multi-dialect introspection functions using @effect/sql with onDialectOrElse.
 * No abstraction layer needed—dialect-specific SQL is handled directly by SqlClient.
 *
 * Each function uses client.onDialectOrElse({ pg: ..., sqlite: ..., orElse: ... })
 * to branch SQL by database dialect at query time.
 */

/**
 * Whether the current remote connection runs on the DuckDB engine — either an
 * actual DuckDB database or a CSV connection (in-memory DuckDB over
 * materialized csv tables). The DuckDB client shim reuses the pg statement
 * compiler, so `sql.onDialectOrElse` selects pg branches; this service (provided
 * by create-remote-server-fn) distinguishes the actual target.
 */
const isDuckDbEngineConnection = Effect.map(
  Effect.serviceOption(RemoteDialect),
  // Note: must be a real lambda — `contains(a) || contains(b)` would break
  // Option.contains's data-last currying and silently drop the Csv branch.
  (dialect) =>
    Option.contains(dialect, DatabaseDialect.DuckDB) ||
    Option.contains(dialect, DatabaseDialect.Csv),
);

/**
 * Get available databases for the connected database
 * - PostgreSQL: Query pg_catalog.pg_database
 * - SQLite: Returns the attached databases
 */
export const getAvailableDatabases = () =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const connectionId = yield* RemoteConnection;

    if (yield* isDuckDbEngineConnection) {
      const query = sql<{ name: string }>`
					SELECT database_name as name FROM duckdb_databases()
					WHERE NOT internal ORDER BY database_name
				`;
      const compiled = query.compile();
      return (yield* query.pipe(
        withQueryLogging({
          type: QueryLogType.SchemaIntrospection,
          sql: compiled[0],
          params: compiled[1],
          level: QueryLogLevel.Trace,
          connectionId,
        }),
      )) as Array<{ name: string }>;
    }

    const result = yield* sql.onDialectOrElse({
      pg: () => {
        const query = sql<{ datname: string }>`
					SELECT datname as name FROM pg_catalog.pg_database ORDER BY datname
				`;
        const compiled = query.compile();
        return query.pipe(
          withQueryLogging({
            type: QueryLogType.SchemaIntrospection,
            sql: compiled[0],
            params: compiled[1],
            level: QueryLogLevel.Trace,
            connectionId,
          }),
        );
      },
      mysql: () => {
        const query = sql<{ name: string }>`
					SELECT SCHEMA_NAME as name FROM information_schema.SCHEMATA ORDER BY SCHEMA_NAME
				`;
        const compiled = query.compile();
        return query.pipe(
          withQueryLogging({
            type: QueryLogType.SchemaIntrospection,
            sql: compiled[0],
            params: compiled[1],
            level: QueryLogLevel.Trace,
            connectionId,
          }),
        );
      },
      sqlite: () => {
        const query = sql<{ name: string }>`
					PRAGMA database_list
				`;
        const compiled = query.compile();
        return query.pipe(
          withQueryLogging({
            type: QueryLogType.SchemaIntrospection,
            sql: compiled[0],
            params: compiled[1],
            level: QueryLogLevel.Trace,
            connectionId,
          }),
        );
      },
      mssql: () => {
        // database_id <= 4: master/tempdb/model/msdb system databases.
        const query = sql<{ name: string }>`
					SELECT name FROM sys.databases
					WHERE database_id > 4 AND state_desc = 'ONLINE'
					ORDER BY name
				`;
        const compiled = query.compile();
        return query.pipe(
          withQueryLogging({
            type: QueryLogType.SchemaIntrospection,
            sql: compiled[0],
            params: compiled[1],
            level: QueryLogLevel.Trace,
            connectionId,
          }),
        );
      },
      clickhouse: () => {
        const query = sql<{ name: string }>`
					SELECT name FROM system.databases
					WHERE name NOT IN ('system', 'INFORMATION_SCHEMA', 'information_schema')
					ORDER BY name
				`;
        const compiled = query.compile();
        return query.pipe(
          withQueryLogging({
            type: QueryLogType.SchemaIntrospection,
            sql: compiled[0],
            params: compiled[1],
            level: QueryLogLevel.Trace,
            connectionId,
          }),
        );
      },
      orElse: () => new SqlError({ cause: "Unsupported dialect" }),
    });

    return result as Array<{ name: string }>;
  });

/**
 * Get available schemas for the connected database
 * - PostgreSQL: Query information_schema.schemata
 * - SQLite: Returns 'main' and 'temp' schemas
 */
export const getAvailableSchemas = () =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const connectionId = yield* RemoteConnection;

    const result = yield* sql.onDialectOrElse({
      pg: () => {
        const query = sql<{ schema_name: string }>`
					SELECT schema_name FROM information_schema.schemata
					WHERE schema_name NOT IN ('pg_catalog', 'information_schema')
					ORDER BY schema_name
				`;
        const compiled = query.compile();
        return query.pipe(
          withQueryLogging({
            type: QueryLogType.SchemaIntrospection,
            sql: compiled[0],
            params: compiled[1],
            level: QueryLogLevel.Trace,
            connectionId,
          }),
        );
      },
      mysql: () => {
        const query = sql<{ schema_name: string }>`
					SELECT SCHEMA_NAME as schema_name FROM information_schema.SCHEMATA
					WHERE SCHEMA_NAME NOT IN ('information_schema', 'mysql', 'performance_schema', 'sys')
					ORDER BY SCHEMA_NAME
				`;
        const compiled = query.compile();
        return query.pipe(
          withQueryLogging({
            type: QueryLogType.SchemaIntrospection,
            sql: compiled[0],
            params: compiled[1],
            level: QueryLogLevel.Trace,
            connectionId,
          }),
        );
      },
      sqlite: () => {
        const query = sql<{ schema_name: string }>`
					SELECT 'main' as schema_name
					UNION SELECT 'temp' as schema_name
				`;
        const compiled = query.compile();
        return query.pipe(
          withQueryLogging({
            type: QueryLogType.SchemaIntrospection,
            sql: compiled[0],
            params: compiled[1],
            level: QueryLogLevel.Trace,
            connectionId,
          }),
        );
      },
      mssql: () => {
        const query = sql<{ schema_name: string }>`
					SELECT name AS schema_name FROM sys.schemas
					WHERE name NOT IN ('guest', 'INFORMATION_SCHEMA', 'sys', 'db_owner', 'db_accessadmin', 'db_securityadmin', 'db_ddladmin', 'db_backupoperator', 'db_datareader', 'db_datawriter', 'db_denydatareader', 'db_denydatawriter')
					ORDER BY name
				`;
        const compiled = query.compile();
        return query.pipe(
          withQueryLogging({
            type: QueryLogType.SchemaIntrospection,
            sql: compiled[0],
            params: compiled[1],
            level: QueryLogLevel.Trace,
            connectionId,
          }),
        );
      },
      clickhouse: () => {
        // ClickHouse databases are the schema level; system DBs are hidden.
        const query = sql<{ schema_name: string }>`
					SELECT name AS schema_name FROM system.databases
					WHERE name NOT IN ('system', 'INFORMATION_SCHEMA', 'information_schema')
					ORDER BY name
				`;
        const compiled = query.compile();
        return query.pipe(
          withQueryLogging({
            type: QueryLogType.SchemaIntrospection,
            sql: compiled[0],
            params: compiled[1],
            level: QueryLogLevel.Trace,
            connectionId,
          }),
        );
      },
      orElse: () => new SqlError({ cause: "Unsupported dialect" }),
    });

    return result.map((row) => row.schema_name);
  });

/**
 * Get available tables in a schema
 * - PostgreSQL: Query information_schema.tables
 * - SQLite: Query sqlite_master
 */
export const getAvailableTables = (input?: { schema?: string }) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const connectionId = yield* RemoteConnection;

    const result = yield* sql.onDialectOrElse({
      pg: () => {
        const query = sql`
					SELECT table_name as name, table_schema as schema FROM information_schema.tables
					WHERE table_schema = ${input?.schema || getDialectDefaultSchema(DatabaseDialect.Postgres)}
					AND table_type = 'BASE TABLE'
					ORDER BY table_name
				`;
        const compiled = query.compile();
        return query.pipe(
          withQueryLogging({
            type: QueryLogType.SchemaIntrospection,
            sql: compiled[0],
            params: compiled[1],
            schema: input?.schema,
            level: QueryLogLevel.Trace,
            connectionId,
          }),
        );
      },
      mysql: () => {
        const schema = input?.schema;
        const query = schema
          ? sql`
					SELECT table_name as name, table_schema as schema FROM information_schema.tables
					WHERE table_schema = ${schema}
					AND table_type = 'BASE TABLE'
					ORDER BY table_name
				`
          : sql`
					SELECT table_name as name, table_schema as schema FROM information_schema.tables
					WHERE table_schema = DATABASE()
					AND table_type = 'BASE TABLE'
					ORDER BY table_name
				`;
        const compiled = query.compile();
        return query.pipe(
          withQueryLogging({
            type: QueryLogType.SchemaIntrospection,
            sql: compiled[0],
            params: compiled[1],
            schema: input?.schema,
            level: QueryLogLevel.Trace,
            connectionId,
          }),
        );
      },
      sqlite: () => {
        const query = sql`
					SELECT name as name FROM sqlite_master
					WHERE type = 'table'
					AND name NOT LIKE 'sqlite_%'
					ORDER BY name
				`;
        const compiled = query.compile();
        return query.pipe(
          withQueryLogging({
            type: QueryLogType.SchemaIntrospection,
            sql: compiled[0],
            params: compiled[1],
            schema: input?.schema,
            level: QueryLogLevel.Trace,
            connectionId,
          }),
        );
      },
      mssql: () => {
        // `schema` is a reserved keyword in T-SQL — bracket-quoted alias required.
        const query = sql<{ name: string; schema: string }>`
					SELECT table_name as name, table_schema as [schema] FROM information_schema.tables
					WHERE table_schema = ${input?.schema || getDialectDefaultSchema(DatabaseDialect.Mssql)}
					AND table_type = 'BASE TABLE'
					ORDER BY table_name
				`;
        const compiled = query.compile();
        return query.pipe(
          withQueryLogging({
            type: QueryLogType.SchemaIntrospection,
            sql: compiled[0],
            params: compiled[1],
            level: QueryLogLevel.Trace,
            connectionId,
          }),
        );
      },
      clickhouse: () => {
        // system.tables is authoritative; view-like engines are excluded so the
        // browser lists base tables only (kind mapping in mapEngineToTableKind).
        const query = sql<{ name: string; schema: string }>`
					SELECT name, database AS \`schema\`
					FROM system.tables
					WHERE database = ${input?.schema || getDialectDefaultSchema(DatabaseDialect.Clickhouse)}
					AND engine NOT IN ('View', 'MaterializedView', 'LiveView', 'WindowView', 'Dictionary')
					ORDER BY name
				`;
        const compiled = query.compile();
        return query.pipe(
          withQueryLogging({
            type: QueryLogType.SchemaIntrospection,
            sql: compiled[0],
            params: compiled[1],
            level: QueryLogLevel.Trace,
            connectionId,
          }),
        );
      },
      orElse: () => new SqlError({ cause: "Unsupported dialect" }),
    });

    return result as Array<{ name: string; schema: string }>;
  });

export type DatabaseObjectKind = "view" | "materialized-view" | "function" | "procedure" | "trigger";

export interface DatabaseObjectMetadata {
  name: string;
  schema: string;
  kind: DatabaseObjectKind;
  definition: string | null;
}

/** Lists non-table schema objects for the navigator and read-only definition viewer. */
export const getDatabaseObjects = (input: { schema?: string }) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const connectionId = yield* RemoteConnection;
    const schema = input.schema || getDialectDefaultSchema(DatabaseDialect.Postgres);

    if (yield* isDuckDbEngineConnection) {
      const query = sql<DatabaseObjectMetadata>`
        SELECT table_name AS name, table_schema AS schema,
               'view' AS kind, view_definition AS definition
        FROM information_schema.views
        WHERE table_schema = ${schema}
        ORDER BY table_name
      `;
      const compiled = query.compile();
      return (yield* query.pipe(
        withQueryLogging({
          type: QueryLogType.SchemaIntrospection,
          sql: compiled[0],
          params: compiled[1],
          schema,
          level: QueryLogLevel.Trace,
          connectionId,
        }),
      )) as DatabaseObjectMetadata[];
    }

    const logQuery = <T extends object>(query: ReturnType<typeof sql<T>>) => {
      const compiled = query.compile();
      return query.pipe(
        withQueryLogging({
          type: QueryLogType.SchemaIntrospection,
          sql: compiled[0],
          params: compiled[1],
          schema,
          level: QueryLogLevel.Trace,
          connectionId,
        }),
      );
    };

    const result = yield* sql.onDialectOrElse({
      pg: () =>
        logQuery(sql<DatabaseObjectMetadata>`
          SELECT c.relname AS name, n.nspname AS schema,
                 CASE c.relkind WHEN 'v' THEN 'view' ELSE 'materialized-view' END AS kind,
                 pg_get_viewdef(c.oid, true) AS definition
          FROM pg_catalog.pg_class c
          JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = ${schema} AND c.relkind IN ('v', 'm')
          UNION ALL
          SELECT p.proname AS name, n.nspname AS schema,
                 CASE p.prokind WHEN 'p' THEN 'procedure' ELSE 'function' END AS kind,
                 pg_get_functiondef(p.oid) AS definition
          FROM pg_catalog.pg_proc p
          JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
          WHERE n.nspname = ${schema}
          UNION ALL
          SELECT trigger_name AS name, event_object_schema AS schema,
                 'trigger' AS kind, action_statement AS definition
          FROM information_schema.triggers
          WHERE event_object_schema = ${schema}
          ORDER BY name
        `),
      mysql: () =>
        logQuery(sql<DatabaseObjectMetadata>`
          SELECT table_name AS name, table_schema AS schema,
                 'view' AS kind, view_definition AS definition
          FROM information_schema.views WHERE table_schema = ${schema}
          UNION ALL
          SELECT routine_name AS name, routine_schema AS schema,
                 CASE routine_type WHEN 'PROCEDURE' THEN 'procedure' ELSE 'function' END AS kind,
                 routine_definition AS definition
          FROM information_schema.routines WHERE routine_schema = ${schema}
          UNION ALL
          SELECT trigger_name AS name, trigger_schema AS schema,
                 'trigger' AS kind, action_statement AS definition
          FROM information_schema.triggers WHERE trigger_schema = ${schema}
          ORDER BY name
        `),
      sqlite: () =>
        logQuery(sql<DatabaseObjectMetadata>`
          SELECT name, 'main' AS schema,
                 CASE type WHEN 'view' THEN 'view' ELSE 'trigger' END AS kind,
                 sql AS definition
          FROM sqlite_master
          WHERE type IN ('view', 'trigger') AND name NOT LIKE 'sqlite_%'
          ORDER BY name
        `),
      mssql: () =>
        logQuery(sql<DatabaseObjectMetadata>`
          SELECT v.name, s.name AS schema, 'view' AS kind, m.definition
          FROM sys.views v JOIN sys.schemas s ON s.schema_id = v.schema_id
          LEFT JOIN sys.sql_modules m ON m.object_id = v.object_id
          WHERE s.name = ${schema}
          UNION ALL
          SELECT o.name, s.name AS schema,
                 CASE o.type WHEN 'P' THEN 'procedure' ELSE 'function' END AS kind,
                 m.definition
          FROM sys.objects o JOIN sys.schemas s ON s.schema_id = o.schema_id
          LEFT JOIN sys.sql_modules m ON m.object_id = o.object_id
          WHERE s.name = ${schema} AND o.type IN ('P', 'FN', 'IF', 'TF')
          UNION ALL
          SELECT tr.name, s.name AS schema, 'trigger' AS kind, m.definition
          FROM sys.triggers tr JOIN sys.objects parent ON parent.object_id = tr.parent_id
          JOIN sys.schemas s ON s.schema_id = parent.schema_id
          LEFT JOIN sys.sql_modules m ON m.object_id = tr.object_id
          WHERE s.name = ${schema}
          ORDER BY name
        `),
      clickhouse: () =>
        logQuery(sql<DatabaseObjectMetadata>`
          SELECT name, database AS schema,
                 CASE WHEN engine = 'MaterializedView' THEN 'materialized-view' ELSE 'view' END AS kind,
                 create_table_query AS definition
          FROM system.tables
          WHERE database = ${schema}
            AND engine IN ('View', 'MaterializedView', 'LiveView', 'WindowView')
          ORDER BY name
        `),
      orElse: () => new SqlError({ cause: "Unsupported dialect" }),
    });

    return result as DatabaseObjectMetadata[];
  });

export interface ColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: boolean;
  column_default: string | null;
  ordinal_position: number;
}

/**
 * Get columns for a table
 * - PostgreSQL: Query information_schema.columns
 * - SQLite: PRAGMA table_info
 */
export const getTableColumns = (input: { schema: string; table: string }) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const connectionId = yield* RemoteConnection;

    if (yield* isDuckDbEngineConnection) {
      // FK metadata via duckdb_constraints() — DuckDB's information_schema
      // constraint_column_usage misreports FK references as local columns.
      const fkRows = yield* fetchDuckDbForeignKeys(sql, { schema: input.schema });
      const fkMap = new Map<
        string,
        {
          referencedSchema: string;
          referencedTable: string;
          referencedColumn: string;
          constraintName: string;
        }
      >();
      for (const fk of fkRows) {
        if (fk.column_name) {
          fkMap.set(fk.column_name, {
            referencedSchema: fk.referenced_table_schema,
            referencedTable: fk.referenced_table_name,
            referencedColumn: fk.referenced_column_name,
            constraintName: fk.constraint_name,
          });
        }
      }

      const columnsQuery = sql`
					SELECT
						c.column_name AS name,
						c.data_type AS "dataType",
						(c.is_nullable = 'YES') AS nullable,
						COALESCE(pk.column_name IS NOT NULL, false) AS "primaryKey",
						COALESCE(uq.column_name IS NOT NULL, false) AS "unique",
						c.column_default AS "defaultValue",
						false AS "isEnum",
						NULL AS "enumValues"
					FROM information_schema.columns c
					LEFT JOIN (
						SELECT kcu.table_schema, kcu.table_name, kcu.column_name
						FROM information_schema.table_constraints tc
						JOIN information_schema.key_column_usage kcu
							ON tc.constraint_name = kcu.constraint_name
						 AND tc.table_schema = kcu.table_schema
						WHERE tc.constraint_type = 'PRIMARY KEY'
					) pk ON pk.table_schema = c.table_schema
						AND pk.table_name = c.table_name AND pk.column_name = c.column_name
					LEFT JOIN (
						SELECT DISTINCT kcu.table_schema, kcu.table_name, kcu.column_name
						FROM information_schema.table_constraints tc
						JOIN information_schema.key_column_usage kcu
							ON tc.constraint_name = kcu.constraint_name
						 AND tc.table_schema = kcu.table_schema
						WHERE tc.constraint_type = 'UNIQUE'
					) uq ON uq.table_schema = c.table_schema
						AND uq.table_name = c.table_name AND uq.column_name = c.column_name
					WHERE c.table_schema = ${input.schema} AND c.table_name = ${input.table}
					ORDER BY c.ordinal_position
				`;
      const columnsCompiledQuery = columnsQuery.compile();
      const columns = yield* columnsQuery.pipe(
        withQueryLogging({
          type: QueryLogType.ColumnMetadata,
          sql: columnsCompiledQuery[0],
          params: columnsCompiledQuery[1],
          schema: input.schema,
          table: input.table,
          level: QueryLogLevel.Trace,
          connectionId,
        }),
      );
      return (
        columns as Array<{
          name: string;
          dataType: string;
          nullable: boolean;
          primaryKey: boolean;
          unique: boolean;
          defaultValue: string | null;
          isEnum: boolean;
          enumValues: string[] | null;
        }>
      ).map((col) => ({
        ...col,
        isEnum: Boolean(col.isEnum),
        enumValues: Array.isArray(col.enumValues) ? col.enumValues.map(String) : null,
        isForeignKey: fkMap.has(col.name),
        foreignKey: fkMap.get(col.name),
      }));
    }

    const output = yield* sql.onDialectOrElse({
      pg: () =>
        Effect.gen(function* () {
          // First, get all foreign keys for this table using a simpler query
          const fkQuery = sql<{
            columnName: string;
            referencedSchema: string;
            referencedTable: string;
            referencedColumn: string;
            constraintName: string;
          }>`
				SELECT
					a.attname AS "columnName",
					nf.nspname AS "referencedSchema",
					cf.relname AS "referencedTable",
					af.attname AS "referencedColumn",
					con.conname AS "constraintName"
				FROM
					pg_attribute a
					JOIN pg_class c ON a.attrelid = c.oid
					JOIN pg_namespace n ON c.relnamespace = n.oid
					JOIN pg_constraint con ON con.conrelid = c.oid AND a.attnum = ANY(con.conkey)
					JOIN pg_class cf ON con.confrelid = cf.oid
					JOIN pg_namespace nf ON cf.relnamespace = nf.oid
					JOIN pg_attribute af ON af.attrelid = cf.oid AND af.attnum = ANY(con.confkey)
				WHERE
					n.nspname = ${input.schema}
					AND c.relname = ${input.table}
					AND con.contype = 'f'
					AND a.attnum > 0
					AND NOT a.attisdropped
			`;
          const fkCompiledQuery = fkQuery.compile();
          const fkQueryResult = yield* fkQuery.pipe(
            withQueryLogging({
              type: QueryLogType.ColumnMetadata,
              sql: fkCompiledQuery[0],
              params: fkCompiledQuery[1],
              schema: input.schema,
              table: input.table,
              level: QueryLogLevel.Trace,
              connectionId,
            }),
          );

          const foreignKeys = fkQueryResult;
          // Create a map for quick FK lookup
          const fkMap = new Map<
            string,
            {
              referencedSchema: string;
              referencedTable: string;
              referencedColumn: string;
              constraintName: string;
            }
          >();
          foreignKeys.forEach((fk) => {
            fkMap.set(fk.columnName, {
              referencedSchema: fk.referencedSchema,
              referencedTable: fk.referencedTable,
              referencedColumn: fk.referencedColumn,
              constraintName: fk.constraintName,
            });
          });

          const columnsQuery = sql<{
            name: string;
            dataType: string;
            nullable: boolean;
            primaryKey: boolean;
            unique: boolean;
            defaultValue: string | null;
            isEnum: boolean;
            enumValues: string[] | null;
          }>`
			SELECT DISTINCT ON (a.attnum)
				a.attname as name,
				format_type(a.atttypid, a.atttypmod) as "dataType",
				NOT a.attnotnull as nullable,
				(t.contype = 'p') as "primaryKey",
				(u.contype = 'u') as "unique",
				pg_get_expr(d.adbin, d.adrelid) as "defaultValue",
				(typ.typtype = 'e') as "isEnum",
				CASE
					WHEN typ.typtype = 'e' THEN (
						SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder)
						FROM pg_enum e
						WHERE e.enumtypid = a.atttypid
					)
					ELSE NULL
				END as "enumValues"
			FROM
				pg_attribute a
				LEFT JOIN pg_constraint t ON a.attrelid = t.conrelid AND a.attnum = ANY(t.conkey) AND t.contype = 'p'
				LEFT JOIN pg_constraint u ON a.attrelid = u.conrelid AND a.attnum = ANY(u.conkey) AND u.contype = 'u'
				LEFT JOIN pg_attrdef d ON a.attrelid = d.adrelid AND a.attnum = d.adnum
				JOIN pg_class c ON a.attrelid = c.oid
				JOIN pg_namespace n ON c.relnamespace = n.oid
				JOIN pg_type typ ON a.atttypid = typ.oid
			WHERE
				n.nspname = ${input.schema}
				AND c.relname = ${input.table}
				AND a.attnum > 0
				AND NOT a.attisdropped
			ORDER BY
				a.attnum
		`;
          const columnsCompiledQuery = columnsQuery.compile();
          const columns = yield* columnsQuery.pipe(
            withQueryLogging({
              type: QueryLogType.ColumnMetadata,
              sql: columnsCompiledQuery[0],
              params: columnsCompiledQuery[1],
              schema: input.schema,
              table: input.table,
              level: QueryLogLevel.Trace,
              connectionId,
            }),
          );
          // Merge FK info with column metadata
          // oxlint-disable-next-line oxc/no-map-spread
          return columns.map((col) => ({
            ...col,
            isEnum: Boolean(col.isEnum),
            enumValues: Array.isArray(col.enumValues) ? col.enumValues.map(String) : null,
            isForeignKey: fkMap.has(col.name),
            foreignKey: fkMap.get(col.name),
          }));
        }),
      mysql: () =>
        Effect.gen(function* () {
          const schema = input.schema;
          const fkQuery = schema
            ? sql<{
                columnName: string;
                referencedSchema: string;
                referencedTable: string;
                referencedColumn: string;
                constraintName: string;
              }>`
				SELECT
					kcu.COLUMN_NAME AS columnName,
					kcu.REFERENCED_TABLE_SCHEMA AS referencedSchema,
					kcu.REFERENCED_TABLE_NAME AS referencedTable,
					kcu.REFERENCED_COLUMN_NAME AS referencedColumn,
					kcu.CONSTRAINT_NAME AS constraintName
				FROM information_schema.KEY_COLUMN_USAGE kcu
				WHERE kcu.TABLE_SCHEMA = ${schema}
					AND kcu.TABLE_NAME = ${input.table}
					AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
			`
            : sql<{
                columnName: string;
                referencedSchema: string;
                referencedTable: string;
                referencedColumn: string;
                constraintName: string;
              }>`
				SELECT
					kcu.COLUMN_NAME AS columnName,
					kcu.REFERENCED_TABLE_SCHEMA AS referencedSchema,
					kcu.REFERENCED_TABLE_NAME AS referencedTable,
					kcu.REFERENCED_COLUMN_NAME AS referencedColumn,
					kcu.CONSTRAINT_NAME AS constraintName
				FROM information_schema.KEY_COLUMN_USAGE kcu
				WHERE kcu.TABLE_SCHEMA = DATABASE()
					AND kcu.TABLE_NAME = ${input.table}
					AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
			`;
          const fkCompiled = fkQuery.compile();
          const foreignKeys = yield* fkQuery.pipe(
            withQueryLogging({
              type: QueryLogType.ColumnMetadata,
              sql: fkCompiled[0],
              params: fkCompiled[1],
              schema: input.schema,
              table: input.table,
              level: QueryLogLevel.Trace,
              connectionId,
            }),
          );
          const fkMap = new Map<
            string,
            {
              referencedSchema: string;
              referencedTable: string;
              referencedColumn: string;
              constraintName: string;
            }
          >();
          for (const fk of foreignKeys) {
            fkMap.set(fk.columnName, {
              referencedSchema: fk.referencedSchema,
              referencedTable: fk.referencedTable,
              referencedColumn: fk.referencedColumn,
              constraintName: fk.constraintName,
            });
          }

          const columnsQuery = schema
            ? sql<{
                name: string;
                dataType: string;
                nullable: number | boolean;
                primaryKey: number | boolean;
                unique: number | boolean;
                defaultValue: string | null;
              }>`
			SELECT
				COLUMN_NAME as name,
				COLUMN_TYPE as dataType,
				IS_NULLABLE = 'YES' as nullable,
				COLUMN_KEY = 'PRI' as primaryKey,
				COLUMN_KEY = 'UNI' as unique,
				COLUMN_DEFAULT as defaultValue
			FROM information_schema.COLUMNS
			WHERE TABLE_SCHEMA = ${schema}
				AND TABLE_NAME = ${input.table}
			ORDER BY ORDINAL_POSITION
		`
            : sql<{
                name: string;
                dataType: string;
                nullable: number | boolean;
                primaryKey: number | boolean;
                unique: number | boolean;
                defaultValue: string | null;
              }>`
			SELECT
				COLUMN_NAME as name,
				COLUMN_TYPE as dataType,
				IS_NULLABLE = 'YES' as nullable,
				COLUMN_KEY = 'PRI' as primaryKey,
				COLUMN_KEY = 'UNI' as unique,
				COLUMN_DEFAULT as defaultValue
			FROM information_schema.COLUMNS
			WHERE TABLE_SCHEMA = DATABASE()
				AND TABLE_NAME = ${input.table}
			ORDER BY ORDINAL_POSITION
		`;
          const columnsCompiled = columnsQuery.compile();
          const columns = yield* columnsQuery.pipe(
            withQueryLogging({
              type: QueryLogType.ColumnMetadata,
              sql: columnsCompiled[0],
              params: columnsCompiled[1],
              schema: input.schema,
              table: input.table,
              level: QueryLogLevel.Trace,
              connectionId,
            }),
          );
          return columns.map((col) => ({
            name: col.name,
            dataType: String(col.dataType),
            nullable: Boolean(col.nullable),
            primaryKey: Boolean(col.primaryKey),
            unique: Boolean(col.unique),
            defaultValue: col.defaultValue,
            isEnum: false,
            enumValues: null,
            isForeignKey: fkMap.has(col.name),
            foreignKey: fkMap.get(col.name),
          }));
        }),
      sqlite: () =>
        Effect.gen(function* () {
          // Get table schema from PRAGMA table_info
          const tableInfoQuery = sql<{
            cid: number;
            name: string;
            type: string;
            notnull: number;
            dflt_value: string | null;
            pk: number;
          }>`PRAGMA table_info(${sql(input.table)})`;
          const tableInfoCompiled = tableInfoQuery.compile();
          const tableInfo = yield* tableInfoQuery.pipe(
            withQueryLogging({
              type: QueryLogType.ColumnMetadata,
              sql: tableInfoCompiled[0],
              params: tableInfoCompiled[1],
              schema: input.schema,
              table: input.table,
              level: QueryLogLevel.Trace,
              connectionId,
            }),
          );

          // Get foreign keys for this table
          const fksQuery = sql<PragmaForeignKeyInfo>`PRAGMA foreign_key_list(${sql(input.table)})`;
          const fksCompiled = fksQuery.compile();
          const fks = yield* fksQuery.pipe(
            withQueryLogging({
              type: QueryLogType.ForeignKeyLookup,
              sql: fksCompiled[0],
              params: fksCompiled[1],
              schema: input.schema,
              table: input.table,
              level: QueryLogLevel.Trace,
              connectionId,
            }),
          );

          // Create FK map for quick lookup
          const fkMap = new Map<
            string,
            {
              referencedSchema: string;
              referencedTable: string;
              referencedColumn: string;
              constraintName: string;
            }
          >();

          fks.forEach((fk) => {
            fkMap.set(fk.from, {
              referencedSchema: "", // SQLite doesn't have schemas
              referencedTable: fk.table,
              referencedColumn: fk.to,
              constraintName: `fk_${fk.id}`,
            });
          });

          // Convert PRAGMA table_info to our TableColumnMetadata format
          return tableInfo.map((col) => ({
            name: col.name,
            dataType: col.type.toLowerCase(), // Normalize to lowercase like PostgreSQL
            nullable: col.notnull === 0,
            primaryKey: col.pk > 0,
            unique: false, // Would need to check indexes for unique columns
            defaultValue: col.dflt_value,
            isForeignKey: fkMap.has(col.name),
            foreignKey: fkMap.get(col.name),
          }));
        }),
      mssql: () =>
        Effect.gen(function* () {
          // FK metadata from sys.* — information_schema.constraint_column_usage
          // does not exist in SQL Server.
          const fkQuery = sql<{
            columnName: string;
            referencedSchema: string;
            referencedTable: string;
            referencedColumn: string;
            constraintName: string;
          }>`
				SELECT
					fk.name AS constraintName,
					pc.name AS columnName,
					rs.name AS referencedSchema,
					rt.name AS referencedTable,
					rc.name AS referencedColumn
				FROM sys.foreign_keys fk
				JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
				JOIN sys.tables pt ON pt.object_id = fk.parent_object_id
				JOIN sys.schemas ps ON ps.schema_id = pt.schema_id
				JOIN sys.columns pc ON pc.object_id = fkc.parent_object_id AND pc.column_id = fkc.parent_column_id
				JOIN sys.tables rt ON rt.object_id = fk.referenced_object_id
				JOIN sys.schemas rs ON rs.schema_id = rt.schema_id
				JOIN sys.columns rc ON rc.object_id = fkc.referenced_object_id AND rc.column_id = fkc.referenced_column_id
				WHERE ps.name = ${input.schema}
					AND pt.name = ${input.table}
			`;
          const fkCompiled = fkQuery.compile();
          const foreignKeys = yield* fkQuery.pipe(
            withQueryLogging({
              type: QueryLogType.ForeignKeyLookup,
              sql: fkCompiled[0],
              params: fkCompiled[1],
              schema: input.schema,
              table: input.table,
              level: QueryLogLevel.Trace,
              connectionId,
            }),
          );
          const fkMap = new Map<
            string,
            {
              referencedSchema: string;
              referencedTable: string;
              referencedColumn: string;
              constraintName: string;
            }
          >();
          for (const fk of foreignKeys) {
            fkMap.set(fk.columnName, {
              referencedSchema: fk.referencedSchema,
              referencedTable: fk.referencedTable,
              referencedColumn: fk.referencedColumn,
              constraintName: fk.constraintName,
            });
          }

          const columnsQuery = sql<{
            name: string;
            dataType: string;
            nullable: number | boolean;
            primaryKey: number | boolean;
            unique: number | boolean;
            defaultValue: string | null;
          }>`
			SELECT
				c.COLUMN_NAME as name,
				c.DATA_TYPE as "dataType",
				CASE WHEN c.IS_NULLABLE = 'YES' THEN 1 ELSE 0 END as nullable,
				CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END as "primaryKey",
				CASE WHEN uq.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END as "unique",
				c.COLUMN_DEFAULT as "defaultValue"
			FROM INFORMATION_SCHEMA.COLUMNS c
			LEFT JOIN (
				SELECT kcu.TABLE_SCHEMA, kcu.TABLE_NAME, kcu.COLUMN_NAME
				FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
				JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
					ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
					AND tc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
				WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
			) pk ON pk.TABLE_SCHEMA = c.TABLE_SCHEMA
				AND pk.TABLE_NAME = c.TABLE_NAME AND pk.COLUMN_NAME = c.COLUMN_NAME
			LEFT JOIN (
				SELECT DISTINCT kcu.TABLE_SCHEMA, kcu.TABLE_NAME, kcu.COLUMN_NAME
				FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
				JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
					ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
					AND tc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
				WHERE tc.CONSTRAINT_TYPE = 'UNIQUE'
			) uq ON uq.TABLE_SCHEMA = c.TABLE_SCHEMA
				AND uq.TABLE_NAME = c.TABLE_NAME AND uq.COLUMN_NAME = c.COLUMN_NAME
			WHERE c.TABLE_SCHEMA = ${input.schema}
				AND c.TABLE_NAME = ${input.table}
			ORDER BY c.ORDINAL_POSITION
		`;
          const columnsCompiled = columnsQuery.compile();
          const columns = yield* columnsQuery.pipe(
            withQueryLogging({
              type: QueryLogType.ColumnMetadata,
              sql: columnsCompiled[0],
              params: columnsCompiled[1],
              schema: input.schema,
              table: input.table,
              level: QueryLogLevel.Trace,
              connectionId,
            }),
          );
          // SQL Server wraps COLUMN_DEFAULT in layers of parentheses — `(('none'))`.
          const stripDefaultParens = (value: string | null): string | null => {
            if (value === null) return value;
            let out = value.trim();
            while (out.startsWith("(") && out.endsWith(")")) out = out.slice(1, -1).trim();
            return out;
          };
          return columns.map((col) => ({
            name: col.name,
            dataType: String(col.dataType),
            nullable: Boolean(col.nullable),
            primaryKey: Boolean(col.primaryKey),
            unique: Boolean(col.unique),
            defaultValue: stripDefaultParens(col.defaultValue),
            isEnum: false,
            enumValues: null,
            isForeignKey: fkMap.has(col.name),
            foreignKey: fkMap.get(col.name),
          }));
        }),
      clickhouse: () =>
        Effect.gen(function* () {
          // No foreign keys exist in ClickHouse (by design); uniqueness is not
          // enforced. Primary key = the table's `primary_key` expression columns
          // (system.tables), matched as whole tokens in JS to avoid dialect-risky
          // string splitting inside SQL.
          const pkQuery = sql<{ primary_key: string }>`
					SELECT primary_key FROM system.tables
					WHERE database = ${input.schema} AND name = ${input.table}
				`;
          const pkCompiled = pkQuery.compile();
          const pkRows = yield* pkQuery.pipe(
            withQueryLogging({
              type: QueryLogType.ColumnMetadata,
              sql: pkCompiled[0],
              params: pkCompiled[1],
              schema: input.schema,
              table: input.table,
              level: QueryLogLevel.Trace,
              connectionId,
            }),
          );
          const pkTokens = new Set(
            (pkRows[0]?.primary_key ?? "")
              .split(/[\s,]+/)
              .map((token) => token.replace(/^`|`$/g, ""))
              .filter(Boolean),
          );

          const columnsQuery = sql<{
            name: string;
            dataType: string;
            defaultValue: string | null;
            ordinal: number;
          }>`
					SELECT
						name,
						type AS "dataType",
						CASE WHEN default_kind = 'DEFAULT' THEN default_expr ELSE NULL END AS "defaultValue",
						position AS ordinal
					FROM system.columns
					WHERE database = ${input.schema} AND table = ${input.table}
					ORDER BY position
				`;
          const columnsCompiled = columnsQuery.compile();
          const columns = yield* columnsQuery.pipe(
            withQueryLogging({
              type: QueryLogType.ColumnMetadata,
              sql: columnsCompiled[0],
              params: columnsCompiled[1],
              schema: input.schema,
              table: input.table,
              level: QueryLogLevel.Trace,
              connectionId,
            }),
          );

          return columns.map((col) => {
            const dataType = String(col.dataType);
            const enumValues = parseClickhouseEnumValues(dataType);
            return {
              name: col.name,
              dataType,
              // ClickHouse nullability lives in the type wrapper: Nullable(T).
              nullable: dataType.startsWith("Nullable("),
              primaryKey: pkTokens.has(col.name),
              unique: false,
              defaultValue: col.defaultValue ?? null,
              isEnum: enumValues !== null,
              enumValues,
              isForeignKey: false,
              foreignKey: undefined,
            };
          });
        }),
      orElse: () => new SqlError({ cause: "Unsupported dialect" }),
    });
    return output as Array<TableColumnMetadata>;
  });

export interface ForeignKeyInfo {
  constraint_name: string;
  column_name: string;
  referenced_table_schema: string;
  referenced_table_name: string;
  referenced_column_name: string;
  /** `CASCADE` | `SET NULL` | `SET DEFAULT` | `RESTRICT` | `NO ACTION`. */
  delete_rule: string;
}

interface PragmaForeignKeyInfo {
  id: number;
  seq: number;
  table: string;
  from: string;
  to: string;
  on_delete: string;
  on_update: string;
  match: string;
}

/**
 * Get foreign keys for a table
 * - PostgreSQL: Query information_schema.table_constraints
 * - SQLite: PRAGMA foreign_key_list
 */
export const getTableForeignKeys = (input: { schema: string; table: string }) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const connectionId = yield* RemoteConnection;
    const { schema, table } = input;

    if (yield* isDuckDbEngineConnection) {
      const allFks = yield* fetchDuckDbForeignKeys(sql, { schema });
      return allFks.filter((fk) => fk.table_name === table);
    }

    const result = yield* sql.onDialectOrElse({
      pg: () => {
        const query = sql<ForeignKeyInfo>`
					SELECT
						tc.constraint_name,
						kcu.column_name,
						ccu.table_schema as referenced_table_schema,
						ccu.table_name as referenced_table_name,
						ccu.column_name as referenced_column_name,
						COALESCE(rc.delete_rule, 'NO ACTION') as delete_rule
					FROM information_schema.table_constraints tc
					JOIN information_schema.key_column_usage kcu
						ON tc.constraint_name = kcu.constraint_name
					JOIN information_schema.constraint_column_usage ccu
						ON tc.constraint_name = ccu.constraint_name
					LEFT JOIN information_schema.referential_constraints rc
						ON tc.constraint_name = rc.constraint_name
						AND tc.constraint_schema = rc.constraint_schema
					WHERE tc.constraint_type = 'FOREIGN KEY'
					AND tc.table_schema = ${schema}
					AND tc.table_name = ${table}
				`;
        const compiled = query.compile();
        return query.pipe(
          withQueryLogging({
            type: QueryLogType.ForeignKeyLookup,
            sql: compiled[0],
            params: compiled[1],
            schema,
            table,
            level: QueryLogLevel.Trace,
            connectionId,
          }),
        );
      },
      mysql: () => {
        const query = schema
          ? sql<ForeignKeyInfo>`
					SELECT
						kcu.CONSTRAINT_NAME as constraint_name,
						kcu.COLUMN_NAME as column_name,
						kcu.REFERENCED_TABLE_SCHEMA as referenced_table_schema,
						kcu.REFERENCED_TABLE_NAME as referenced_table_name,
						kcu.REFERENCED_COLUMN_NAME as referenced_column_name,
						COALESCE(rc.DELETE_RULE, 'NO ACTION') as delete_rule
					FROM information_schema.KEY_COLUMN_USAGE kcu
					JOIN information_schema.TABLE_CONSTRAINTS tc
						ON kcu.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
						AND kcu.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA
						AND kcu.TABLE_SCHEMA = tc.TABLE_SCHEMA
					LEFT JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
						ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
						AND kcu.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
					WHERE tc.CONSTRAINT_TYPE = 'FOREIGN KEY'
					AND kcu.TABLE_SCHEMA = ${schema}
					AND kcu.TABLE_NAME = ${table}
					AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
				`
          : sql<ForeignKeyInfo>`
					SELECT
						kcu.CONSTRAINT_NAME as constraint_name,
						kcu.COLUMN_NAME as column_name,
						kcu.REFERENCED_TABLE_SCHEMA as referenced_table_schema,
						kcu.REFERENCED_TABLE_NAME as referenced_table_name,
						kcu.REFERENCED_COLUMN_NAME as referenced_column_name,
						COALESCE(rc.DELETE_RULE, 'NO ACTION') as delete_rule
					FROM information_schema.KEY_COLUMN_USAGE kcu
					JOIN information_schema.TABLE_CONSTRAINTS tc
						ON kcu.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
						AND kcu.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA
						AND kcu.TABLE_SCHEMA = tc.TABLE_SCHEMA
					LEFT JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
						ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
						AND kcu.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
					WHERE tc.CONSTRAINT_TYPE = 'FOREIGN KEY'
					AND kcu.TABLE_SCHEMA = DATABASE()
					AND kcu.TABLE_NAME = ${table}
					AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
				`;
        const compiled = query.compile();
        return query.pipe(
          withQueryLogging({
            type: QueryLogType.ForeignKeyLookup,
            sql: compiled[0],
            params: compiled[1],
            schema,
            table,
            level: QueryLogLevel.Trace,
            connectionId,
          }),
        );
      },
      sqlite: () =>
        Effect.gen(function* () {
          const rowsQuery = sql<PragmaForeignKeyInfo>`
						PRAGMA foreign_key_list(${sql(table)})
					`;
          const rowsCompiled = rowsQuery.compile();
          const rows = yield* rowsQuery.pipe(
            withQueryLogging({
              type: QueryLogType.ForeignKeyLookup,
              sql: rowsCompiled[0],
              params: rowsCompiled[1],
              schema,
              table,
              level: QueryLogLevel.Trace,
              connectionId,
            }),
          );

          // Get column positions for ordering
          const tableInfoQuery = sql<{
            cid: number;
            name: string;
          }>`
						PRAGMA table_info(${sql(table)})
					`;
          const tableInfoCompiled = tableInfoQuery.compile();
          const tableInfo = yield* tableInfoQuery.pipe(
            withQueryLogging({
              type: QueryLogType.SchemaIntrospection,
              sql: tableInfoCompiled[0],
              params: tableInfoCompiled[1],
              schema,
              table,
              level: QueryLogLevel.Trace,
              connectionId,
            }),
          );

          const columnPositions = new Map(tableInfo.map((col) => [col.name, col.cid]));

          return rows
            .map((row) => ({
              constraint_name: `fk_${row.id}`,
              column_name: row.from,
              referenced_table_schema: input.schema,
              referenced_table_name: row.table,
              referenced_column_name: row.to,
              delete_rule: (row.on_delete || "NO ACTION").toUpperCase(),
            }))
            .toSorted((a, b) => {
              const posA = columnPositions.get(a.column_name) ?? 999;
              const posB = columnPositions.get(b.column_name) ?? 999;
              return posA - posB;
            }) as ForeignKeyInfo[];
        }),
      mssql: () => {
        const query = sql<ForeignKeyInfo>`
				SELECT
					fk.name AS constraint_name,
					pc.name AS column_name,
					rs.name AS referenced_table_schema,
					rt.name AS referenced_table_name,
					rc.name AS referenced_column_name,
					CASE fk.delete_referential_action
						WHEN 1 THEN 'CASCADE'
						WHEN 2 THEN 'SET NULL'
						WHEN 3 THEN 'SET DEFAULT'
						ELSE 'NO ACTION'
					END AS delete_rule
				FROM sys.foreign_keys fk
				JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
				JOIN sys.tables pt ON pt.object_id = fk.parent_object_id
				JOIN sys.schemas ps ON ps.schema_id = pt.schema_id
				JOIN sys.columns pc ON pc.object_id = fkc.parent_object_id AND pc.column_id = fkc.parent_column_id
				JOIN sys.tables rt ON rt.object_id = fk.referenced_object_id
				JOIN sys.schemas rs ON rs.schema_id = rt.schema_id
				JOIN sys.columns rc ON rc.object_id = fkc.referenced_object_id AND rc.column_id = fkc.referenced_column_id
				WHERE ps.name = ${schema}
					AND pt.name = ${table}
			`;
        const compiled = query.compile();
        return query.pipe(
          withQueryLogging({
            type: QueryLogType.ForeignKeyLookup,
            sql: compiled[0],
            params: compiled[1],
            level: QueryLogLevel.Trace,
            connectionId,
          }),
        );
      },
      clickhouse: () =>
        // ClickHouse has no foreign keys (by design) — reported honestly as none;
        // relationship panels show no edges for clickhouse connections.
        Effect.succeed([] as Array<ForeignKeyInfo>),
      orElse: () => new SqlError({ cause: "Unsupported dialect" }),
    });

    return result as Array<ForeignKeyInfo>;
  });

export interface IndexInfo {
  index_name: string;
  column_name: string;
  is_unique: boolean;
  is_primary: boolean;
}

interface PragmaIndexInfo {
  seq: number;
  name: string;
  unique: number;
  partial: number;
  origin?: string;
}

/**
 * Get indexes for a table
 * - PostgreSQL: Query pg_indexes
 * - SQLite: PRAGMA index_list
 */
export const getTableIndexes = (input: { schema: string; table: string }) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const connectionId = yield* RemoteConnection;
    const { schema, table } = input;

    if (yield* isDuckDbEngineConnection) {
      // duckdb_indexes() exposes one row per index with the indexed expression
      // list in `expressions` — explode it to one IndexInfo per column.
      const idxRows = yield* sql`
					SELECT index_name, is_unique, is_primary, expressions
					FROM duckdb_indexes()
					WHERE schema_name = ${schema} AND table_name = ${table}
				`.pipe(
        withQueryLogging({
          type: QueryLogType.SchemaIntrospection,
          sql: "duckdb_indexes()",
          params: [],
          schema,
          table,
          level: QueryLogLevel.Trace,
          connectionId,
        }),
      );
      const results: IndexInfo[] = [];
      for (const row of idxRows as Array<Record<string, unknown>>) {
        const exprs = String(row.expressions ?? "")
          .split(",")
          .map((part) => part.trim())
          .filter((part) => part.length > 0);
        for (const expression of exprs.length > 0 ? exprs : [""]) {
          results.push({
            index_name: String(row.index_name ?? ""),
            column_name: expression,
            is_unique: Boolean(row.is_unique),
            is_primary: Boolean(row.is_primary),
          });
        }
      }
      return results;
    }

    const result = yield* sql.onDialectOrElse({
      pg: () => {
        const query = sql<IndexInfo>`
				SELECT DISTINCT
					pi.indexname as index_name,
					a.attname as column_name,
					ix.indisunique as is_unique,
					ix.indisprimary as is_primary
				FROM pg_indexes pi
				JOIN pg_class t ON pi.tablename = t.relname
				JOIN pg_class c ON pi.indexname = c.relname
				JOIN pg_index ix ON c.oid = ix.indexrelid
				JOIN pg_attribute a ON a.attrelid = t.oid
					AND a.attnum = ANY(ix.indkey)
				WHERE pi.schemaname = ${schema}
				AND pi.tablename = ${table}
			`;
        const compiled = query.compile();
        return query.pipe(
          withQueryLogging({
            type: QueryLogType.SchemaIntrospection,
            sql: compiled[0],
            params: compiled[1],
            schema,
            table,
            level: QueryLogLevel.Trace,
            connectionId,
          }),
        );
      },
      mysql: () => {
        const query = schema
          ? sql<IndexInfo>`
				SELECT
					INDEX_NAME as index_name,
					COLUMN_NAME as column_name,
					NON_UNIQUE = 0 as is_unique,
					INDEX_NAME = 'PRIMARY' as is_primary
				FROM information_schema.STATISTICS
				WHERE TABLE_SCHEMA = ${schema}
				AND TABLE_NAME = ${table}
				ORDER BY INDEX_NAME, SEQ_IN_INDEX
			`
          : sql<IndexInfo>`
				SELECT
					INDEX_NAME as index_name,
					COLUMN_NAME as column_name,
					NON_UNIQUE = 0 as is_unique,
					INDEX_NAME = 'PRIMARY' as is_primary
				FROM information_schema.STATISTICS
				WHERE TABLE_SCHEMA = DATABASE()
				AND TABLE_NAME = ${table}
				ORDER BY INDEX_NAME, SEQ_IN_INDEX
			`;
        const compiled = query.compile();
        return query.pipe(
          withQueryLogging({
            type: QueryLogType.SchemaIntrospection,
            sql: compiled[0],
            params: compiled[1],
            schema,
            table,
            level: QueryLogLevel.Trace,
            connectionId,
          }),
        );
      },
      sqlite: () =>
        Effect.gen(function* () {
          const indexListQuery = sql<PragmaIndexInfo>`
					PRAGMA index_list(${sql(table)})
				`;
          const indexListCompiled = indexListQuery.compile();
          const indexList = yield* indexListQuery.pipe(
            withQueryLogging({
              type: QueryLogType.SchemaIntrospection,
              sql: indexListCompiled[0],
              params: indexListCompiled[1],
              schema,
              table,
              level: QueryLogLevel.Trace,
              connectionId,
            }),
          );

          const results: IndexInfo[] = [];

          for (const idx of indexList) {
            // For each index, get its columns
            const idxColsQuery = sql<{
              seqno: number;
              cid: number;
              name: string;
            }>`
						PRAGMA index_info(${sql(idx.name)})
					`;
            const idxColsCompiled = idxColsQuery.compile();
            const idxCols = yield* idxColsQuery.pipe(
              withQueryLogging({
                type: QueryLogType.SchemaIntrospection,
                sql: idxColsCompiled[0],
                params: idxColsCompiled[1],
                schema,
                table,
                level: QueryLogLevel.Trace,
                connectionId,
              }),
            );

            for (const col of idxCols) {
              results.push({
                index_name: idx.name,
                column_name: col.name,
                is_unique: idx.unique === 1,
                is_primary: idx.origin === "pk" || idx.name.startsWith("sqlite_autoindex"),
              });
            }
          }

          return results;
        }),
      mssql: () => {
        const query = sql<IndexInfo>`
				SELECT
					i.name AS index_name,
					c.name AS column_name,
					CASE WHEN i.is_unique = 1 THEN 1 ELSE 0 END AS is_unique,
					CASE WHEN i.is_primary_key = 1 THEN 1 ELSE 0 END AS is_primary
				FROM sys.indexes i
				JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
				JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
				JOIN sys.tables t ON t.object_id = i.object_id
				JOIN sys.schemas s ON s.schema_id = t.schema_id
				WHERE s.name = ${schema}
					AND t.name = ${table}
				ORDER BY i.name, ic.key_ordinal
			`;
        const compiled = query.compile();
        return query.pipe(
          withQueryLogging({
            type: QueryLogType.SchemaIntrospection,
            sql: compiled[0],
            params: compiled[1],
            level: QueryLogLevel.Trace,
            connectionId,
          }),
        );
      },
      // ClickHouse: the primary/sorting key is the only ordered access structure
      // (plus optional data-skipping indexes); report it as the single index.
      clickhouse: () => {
        const query = sql<IndexInfo>`
					SELECT
						'primary' AS index_name,
						column_name,
						false AS is_unique,
						true AS is_primary
					FROM system.columns
					WHERE database = ${schema} AND table = ${table}
					AND hasToken(
						(SELECT primary_key FROM system.tables WHERE database = ${schema} AND name = ${table}),
						name
					)
					ORDER BY position
				`;
        const compiled = query.compile();
        return query.pipe(
          withQueryLogging({
            type: QueryLogType.SchemaIntrospection,
            sql: compiled[0],
            params: compiled[1],
            level: QueryLogLevel.Trace,
            connectionId,
          }),
        );
      },
      orElse: () => new SqlError({ cause: "Unsupported dialect" }),
    });

    return result as Array<IndexInfo>;
  });
export interface AllTablesForeignKeyInfo {
  referencedSchema: string;
  referencedTable: string;
  referencedColumn: string;
  constraintName: string;
}

export interface TableColumnMetadata {
  name: string;
  dataType: string;
  nullable: boolean;
  primaryKey: boolean;
  unique: boolean;
  defaultValue: string | null;
  /** True when the PG column type is an enum (typtype = 'e'). */
  isEnum?: boolean;
  /** Ordered enum labels when isEnum is true. */
  enumValues?: string[] | null;
  isForeignKey?: boolean;
  foreignKey?: {
    referencedSchema: string;
    referencedTable: string;
    referencedColumn: string;
    constraintName: string;
  };
}

export interface TableWithColumnsMetadata {
  table: string;
  columns: Array<TableColumnMetadata>;
}

/**
 * Get all tables and their columns (including basic FK mapping)
 * Reuses existing multi-dialect helpers `getAvailableTables`, `getTableColumns`,
 * and `getTableForeignKeys` so logic stays consistent across drivers.
 */
export const getAllTablesColumns = (input: { schema: string }) =>
  Effect.gen(function* () {
    const { schema } = input;

    const tables = yield* getAvailableTables({ schema });

    // For each table, fetch columns and foreign keys and merge them
    const tablesWithColumns = yield* Effect.all(
      tables.map((table) =>
        Effect.gen(function* () {
          const [cols, fks, indexes] = yield* Effect.all(
            [
              getTableColumns({ schema, table: table.name }),
              getTableForeignKeys({ schema, table: table.name }),
              getTableIndexes({ schema, table: table.name }),
            ],
            { concurrency: ALL_TABLES_INTROSPECTION_CONCURRENCY },
          );

          // Build FK map keyed by column_name (getTableForeignKeys returns snake_case keys)
          const fkMap = new Map<string, AllTablesForeignKeyInfo>();
          for (const fk of fks) {
            fkMap.set(fk.column_name, {
              referencedSchema: fk.referenced_table_schema ?? fk.referenced_table_schema,
              referencedTable: fk.referenced_table_name,
              referencedColumn: fk.referenced_column_name,
              constraintName: fk.constraint_name,
            });
          }

          // Build sets for primary key and unique columns from indexes (PG) or column info (SQLite)
          const pkSet = new Set<string>();
          const uniqueSet = new Set<string>();

          // Indexes may contain multiple entries per index (one per column)
          for (const idx of indexes) {
            if (idx.is_primary) pkSet.add(idx.column_name);
            if (idx.is_unique) uniqueSet.add(idx.column_name);
          }

          // For sqlite, PRAGMA table_info provides pk flag on columns; ensure we include those
          for (const c of cols) {
            if (c.primaryKey) pkSet.add(c.name);
          }
          const columns = cols.map((c) => ({
            name: c.name,
            dataType: c.dataType,
            nullable: Boolean(c.nullable),
            primaryKey: pkSet.has(c.name) || false,
            unique: uniqueSet.has(c.name) || false,
            defaultValue: c.defaultValue ?? null,
            isEnum: c.isEnum,
            enumValues: c.enumValues ?? null,
            isForeignKey: fkMap.has(c.name),
            foreignKey: fkMap.has(c.name) ? fkMap.get(c.name) : undefined,
          }));

          return {
            table: table.name,
            columns,
          } as TableWithColumnsMetadata;
        }),
      ),
      { concurrency: ALL_TABLES_INTROSPECTION_CONCURRENCY },
    );

    return tablesWithColumns;
  });

export interface SchemaForeignKeyEdge {
  fromTable: string;
  fromColumns: string[];
  toSchema: string;
  toTable: string;
  toColumns: string[];
  constraintName: string;
  /** `CASCADE` | `SET NULL` | `SET DEFAULT` | `RESTRICT` | `NO ACTION`. */
  onDelete: string;
}

/**
 * Get every foreign key edge across all tables in a schema, grouped by constraint so
 * multi-column FKs collapse into a single edge. Used by the ER diagram and the
 * cascade-delete preview, both of which need whole-schema FK topology (not just one table).
 */
export const getAllTablesForeignKeys = (input: { schema: string }) =>
  Effect.gen(function* () {
    const { schema } = input;
    const tables = yield* getAvailableTables({ schema });

    const perTableFks = yield* Effect.all(
      tables.map((table) =>
        Effect.gen(function* () {
          const fks = yield* getTableForeignKeys({ schema, table: table.name });
          return { table: table.name, fks };
        }),
      ),
      { concurrency: ALL_TABLES_INTROSPECTION_CONCURRENCY },
    );

    const edges: SchemaForeignKeyEdge[] = [];
    for (const { table, fks } of perTableFks) {
      const byConstraint = new Map<string, ForeignKeyInfo[]>();
      for (const fk of fks) {
        const list = byConstraint.get(fk.constraint_name) ?? [];
        list.push(fk);
        byConstraint.set(fk.constraint_name, list);
      }
      for (const [constraintName, cols] of byConstraint) {
        const first = cols[0];
        if (!first) continue;
        edges.push({
          fromTable: table,
          fromColumns: cols.map((c) => c.column_name),
          toSchema: first.referenced_table_schema,
          toTable: first.referenced_table_name,
          toColumns: cols.map((c) => c.referenced_column_name),
          constraintName,
          onDelete: first.delete_rule || "NO ACTION",
        });
      }
    }

    return edges;
  });

/**
 * Get structures for specific tables (or all tables if none specified) in a schema
 * Returns array of table structures with columns and metadata
 */
export const getTablesStructures = (input: { schema: string; tables?: string[] }) =>
  Effect.gen(function* () {
    const { schema, tables: specifiedTables } = input;

    const allTables = yield* getAvailableTables({ schema });

    // Filter to specified tables if provided, otherwise use all
    const tablesToProcess = specifiedTables
      ? allTables.filter((t) => specifiedTables.includes(t.name))
      : allTables;

    // For each table, fetch columns and foreign keys and merge them
    const tablesWithColumns = yield* Effect.all(
      tablesToProcess.map((table) =>
        Effect.gen(function* () {
          const [cols, fks, indexes] = yield* Effect.all(
            [
              getTableColumns({ schema, table: table.name }),
              getTableForeignKeys({ schema, table: table.name }),
              getTableIndexes({ schema, table: table.name }),
            ],
            { concurrency: ALL_TABLES_INTROSPECTION_CONCURRENCY },
          );

          // Build FK map keyed by column_name
          const fkMap = new Map<string, AllTablesForeignKeyInfo>();
          for (const fk of fks) {
            fkMap.set(fk.column_name, {
              referencedSchema: fk.referenced_table_schema ?? fk.referenced_table_schema,
              referencedTable: fk.referenced_table_name,
              referencedColumn: fk.referenced_column_name,
              constraintName: fk.constraint_name,
            });
          }

          // Build sets for primary key and unique columns from indexes
          const pkSet = new Set<string>();
          const uniqueSet = new Set<string>();

          for (const idx of indexes) {
            if (idx.is_primary) pkSet.add(idx.column_name);
            if (idx.is_unique) uniqueSet.add(idx.column_name);
          }

          for (const c of cols) {
            if (c.primaryKey) pkSet.add(c.name);
          }

          const columns = cols.map((c) => ({
            name: c.name,
            dataType: c.dataType,
            nullable: Boolean(c.nullable),
            primaryKey: pkSet.has(c.name) || false,
            unique: uniqueSet.has(c.name) || false,
            defaultValue: c.defaultValue ?? null,
            isEnum: c.isEnum,
            enumValues: c.enumValues ?? null,
            isForeignKey: fkMap.has(c.name),
            foreignKey: fkMap.has(c.name) ? fkMap.get(c.name) : undefined,
          }));

          return {
            table: table.name,
            columns,
          } as TableWithColumnsMetadata;
        }),
      ),
      { concurrency: ALL_TABLES_INTROSPECTION_CONCURRENCY },
    );

    return tablesWithColumns;
  });

/**
 * Get all relationships for a table (both incoming and outgoing)
 * - PostgreSQL: Query pg_constraint and information_schema
 * - SQLite: PRAGMA foreign_key_list (limited - only outgoing)
 */
export const getTableRelationships = (input: { schema: string; table: string }) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const connectionId = yield* RemoteConnection;
    const { schema, table } = input;

    if (yield* isDuckDbEngineConnection) {
      // Both directions derive from parsed duckdb_constraints() rows — the
      // pg information_schema FK chain misreports referenced columns on DuckDB.
      const allFks = yield* fetchDuckDbForeignKeys(sql, { schema });
      const relationships: TableRelationship[] = [];
      for (const fk of allFks) {
        if (fk.table_name === table) {
          relationships.push({
            type: "outgoing",
            referencingSchema: schema,
            referencingTable: table,
            referencingColumn: fk.column_name,
            referencedSchema: fk.referenced_table_schema,
            referencedTable: fk.referenced_table_name,
            referencedColumn: fk.referenced_column_name,
            constraintName: fk.constraint_name,
          });
        }
        if (fk.referenced_table_name === table) {
          relationships.push({
            type: "incoming",
            referencingSchema: schema,
            referencingTable: fk.table_name,
            referencingColumn: fk.column_name,
            referencedSchema: schema,
            referencedTable: table,
            referencedColumn: fk.referenced_column_name,
            constraintName: fk.constraint_name,
          });
        }
      }
      return relationships;
    }

    const output = yield* sql.onDialectOrElse({
      pg: () => {
        const pgRelQuery = sql<TableRelationship>`
					-- Get outgoing relationships (FKs from this table)
					SELECT
						'outgoing'::text as type,
						${schema}::text as "referencingSchema",
						${table}::text as "referencingTable",
						a.attname::text as "referencingColumn",
						nf.nspname::text as "referencedSchema",
						cf.relname::text as "referencedTable",
						af.attname::text as "referencedColumn",
						con.conname::text as "constraintName"
					FROM
						pg_attribute a
						JOIN pg_class c ON a.attrelid = c.oid
						JOIN pg_namespace n ON c.relnamespace = n.oid
						JOIN pg_constraint con ON con.conrelid = c.oid AND a.attnum = ANY(con.conkey)
						JOIN pg_class cf ON con.confrelid = cf.oid
						JOIN pg_namespace nf ON cf.relnamespace = nf.oid
						JOIN pg_attribute af ON af.attrelid = cf.oid AND af.attnum = ANY(con.confkey)
					WHERE
						n.nspname = ${schema}
						AND c.relname = ${table}
						AND con.contype = 'f'
						AND a.attnum > 0
						AND NOT a.attisdropped

					UNION ALL

					-- Get incoming relationships (FKs pointing to this table)
					SELECT
						'incoming'::text as type,
						kcu1.table_schema::text as "referencingSchema",
						kcu1.table_name::text as "referencingTable",
						kcu1.column_name::text as "referencingColumn",
						${schema}::text as "referencedSchema",
						${table}::text as "referencedTable",
						kcu2.column_name::text as "referencedColumn",
						kcu1.constraint_name::text as "constraintName"
					FROM
						information_schema.key_column_usage kcu1
						LEFT JOIN information_schema.referential_constraints rc ON kcu1.constraint_name = rc.constraint_name
						LEFT JOIN information_schema.key_column_usage kcu2 ON rc.unique_constraint_name = kcu2.constraint_name
					WHERE
						kcu1.constraint_name IN (
							SELECT constraint_name
							FROM information_schema.table_constraints
							WHERE constraint_type = 'FOREIGN KEY'
						)
						AND kcu2.table_schema = ${schema}
						AND kcu2.table_name = ${table}
					ORDER BY
						type, "referencingTable", "referencingColumn"
				`;
        const pgRelCompiledQuery = pgRelQuery.compile();
        return pgRelQuery.pipe(
          withQueryLogging({
            type: QueryLogType.RelationshipDiscovery,
            sql: pgRelCompiledQuery[0],
            params: pgRelCompiledQuery[1],
            schema,
            table,
            level: QueryLogLevel.Trace,
            connectionId,
          }),
        );
      },
      mysql: () =>
        Effect.gen(function* () {
          const outgoingQuery = schema
            ? sql<TableRelationship>`
					SELECT
						'outgoing' as type,
						${schema} as referencingSchema,
						${table} as referencingTable,
						kcu.COLUMN_NAME as referencingColumn,
						kcu.REFERENCED_TABLE_SCHEMA as referencedSchema,
						kcu.REFERENCED_TABLE_NAME as referencedTable,
						kcu.REFERENCED_COLUMN_NAME as referencedColumn,
						kcu.CONSTRAINT_NAME as constraintName
					FROM information_schema.KEY_COLUMN_USAGE kcu
					WHERE kcu.TABLE_SCHEMA = ${schema}
						AND kcu.TABLE_NAME = ${table}
						AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
				`
            : sql<TableRelationship>`
					SELECT
						'outgoing' as type,
						DATABASE() as referencingSchema,
						${table} as referencingTable,
						kcu.COLUMN_NAME as referencingColumn,
						kcu.REFERENCED_TABLE_SCHEMA as referencedSchema,
						kcu.REFERENCED_TABLE_NAME as referencedTable,
						kcu.REFERENCED_COLUMN_NAME as referencedColumn,
						kcu.CONSTRAINT_NAME as constraintName
					FROM information_schema.KEY_COLUMN_USAGE kcu
					WHERE kcu.TABLE_SCHEMA = DATABASE()
						AND kcu.TABLE_NAME = ${table}
						AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
				`;
          const outgoingCompiled = outgoingQuery.compile();
          const outgoing = yield* outgoingQuery.pipe(
            withQueryLogging({
              type: QueryLogType.RelationshipDiscovery,
              sql: outgoingCompiled[0],
              params: outgoingCompiled[1],
              schema,
              table,
              level: QueryLogLevel.Trace,
              connectionId,
            }),
          );

          const incomingQuery = schema
            ? sql<TableRelationship>`
					SELECT
						'incoming' as type,
						kcu.TABLE_SCHEMA as referencingSchema,
						kcu.TABLE_NAME as referencingTable,
						kcu.COLUMN_NAME as referencingColumn,
						${schema} as referencedSchema,
						${table} as referencedTable,
						kcu.REFERENCED_COLUMN_NAME as referencedColumn,
						kcu.CONSTRAINT_NAME as constraintName
					FROM information_schema.KEY_COLUMN_USAGE kcu
					WHERE kcu.REFERENCED_TABLE_SCHEMA = ${schema}
						AND kcu.REFERENCED_TABLE_NAME = ${table}
						AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
				`
            : sql<TableRelationship>`
					SELECT
						'incoming' as type,
						kcu.TABLE_SCHEMA as referencingSchema,
						kcu.TABLE_NAME as referencingTable,
						kcu.COLUMN_NAME as referencingColumn,
						DATABASE() as referencedSchema,
						${table} as referencedTable,
						kcu.REFERENCED_COLUMN_NAME as referencedColumn,
						kcu.CONSTRAINT_NAME as constraintName
					FROM information_schema.KEY_COLUMN_USAGE kcu
					WHERE kcu.REFERENCED_TABLE_SCHEMA = DATABASE()
						AND kcu.REFERENCED_TABLE_NAME = ${table}
						AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
				`;
          const incomingCompiled = incomingQuery.compile();
          const incoming = yield* incomingQuery.pipe(
            withQueryLogging({
              type: QueryLogType.RelationshipDiscovery,
              sql: incomingCompiled[0],
              params: incomingCompiled[1],
              schema,
              table,
              level: QueryLogLevel.Trace,
              connectionId,
            }),
          );
          return [...outgoing, ...incoming];
        }),
      sqlite: () =>
        Effect.gen(function* () {
          // Get outgoing relationships via PRAGMA
          const outgoingRows = yield* sql<PragmaForeignKeyInfo>`
						PRAGMA foreign_key_list(${sql(table)})
					`;

          const outgoing = outgoingRows.map((row) => ({
            type: "outgoing" as const,
            referencingSchema: schema,
            referencingTable: table,
            referencingColumn: row.from,
            referencedSchema: schema,
            referencedTable: row.table,
            referencedColumn: row.to,
            constraintName: `fk_${row.id}`,
          }));

          // Get incoming relationships by finding all FK references to this table
          // For each column in this table, find tables that reference it
          const tableInfo = yield* sql<{
            name: string;
          }>`
						PRAGMA table_info(${sql(table)})
					`;

          const incomingRelationships: TableRelationship[] = [];
          for (const col of tableInfo) {
            const refs = yield* findColumnReferences({
              referencedSchema: schema,
              referencedTable: table,
              referencedColumn: col.name,
            });

            for (const ref of refs) {
              incomingRelationships.push({
                type: "incoming" as const,
                referencingSchema: ref.schema,
                referencingTable: ref.table,
                referencingColumn: ref.column,
                referencedSchema: schema,
                referencedTable: table,
                referencedColumn: ref.referencedColumn,
                constraintName: ref.constraintName,
              });
            }
          }

          // Combine and sort
          const combined = [...outgoing, ...incomingRelationships].toSorted((a, b) => {
            const typeOrder = { outgoing: 0, incoming: 1 };
            if (typeOrder[a.type] !== typeOrder[b.type]) {
              return typeOrder[a.type] - typeOrder[b.type];
            }
            if (a.referencingTable !== b.referencingTable) {
              return a.referencingTable.localeCompare(b.referencingTable);
            }
            return a.referencingColumn.localeCompare(b.referencingColumn);
          });

          return combined;
        }),
      mssql: () => {
        const outgoingQuery = sql<TableRelationship>`
				SELECT
					'outgoing' AS type,
					ps.name AS "referencingSchema",
					pt.name AS "referencingTable",
					pc.name AS "referencingColumn",
					rs.name AS "referencedSchema",
					rt.name AS "referencedTable",
					rc.name AS "referencedColumn",
					fk.name AS "constraintName"
				FROM sys.foreign_keys fk
				JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
				JOIN sys.tables pt ON pt.object_id = fk.parent_object_id
				JOIN sys.schemas ps ON ps.schema_id = pt.schema_id
				JOIN sys.columns pc ON pc.object_id = fkc.parent_object_id AND pc.column_id = fkc.parent_column_id
				JOIN sys.tables rt ON rt.object_id = fk.referenced_object_id
				JOIN sys.schemas rs ON rs.schema_id = rt.schema_id
				JOIN sys.columns rc ON rc.object_id = fkc.referenced_object_id AND rc.column_id = fkc.referenced_column_id
				WHERE ps.name = ${schema}
					AND pt.name = ${table}
			`;
        const incomingQuery = sql<TableRelationship>`
				SELECT
					'incoming' AS type,
					psn.name AS "referencingSchema",
					ptn.name AS "referencingTable",
					pcn.name AS "referencingColumn",
					rs.name AS "referencedSchema",
					rt.name AS "referencedTable",
					rc.name AS "referencedColumn",
					fk.name AS "constraintName"
				FROM sys.foreign_keys fk
				JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
				JOIN sys.tables rt ON rt.object_id = fk.referenced_object_id
				JOIN sys.schemas rs ON rs.schema_id = rt.schema_id
				JOIN sys.columns rc ON rc.object_id = fkc.referenced_object_id AND rc.column_id = fkc.referenced_column_id
				JOIN sys.tables ptn ON ptn.object_id = fk.parent_object_id
				JOIN sys.schemas psn ON psn.schema_id = ptn.schema_id
				JOIN sys.columns pcn ON pcn.object_id = fkc.parent_object_id AND pcn.column_id = fkc.parent_column_id
				WHERE rs.name = ${schema}
					AND rt.name = ${table}
			`;
        return Effect.all([outgoingQuery, incomingQuery]).pipe(
          Effect.map(([outgoing, incoming]) => [...outgoing, ...incoming]),
          withQueryLogging({
            type: QueryLogType.RelationshipDiscovery,
            sql: `${outgoingQuery.compile()[0]}; ${incomingQuery.compile()[0]}`,
            params: [...outgoingQuery.compile()[1], ...incomingQuery.compile()[1]],
            schema,
            table,
            level: QueryLogLevel.Trace,
            connectionId,
          }),
        );
      },
      clickhouse: () =>
        // No FKs in ClickHouse — no relationships to report (see getTableForeignKeys).
        Effect.succeed([] as Array<TableRelationship>),
      orElse: () => new SqlError({ cause: "Unsupported dialect" }),
    });

    return output as Array<TableRelationship>;
  });
export interface ColumnReference {
  schema: string;
  table: string;
  column: string;
  referencedColumn: string;
  constraintName: string;
}
export interface ColumnReferenceWithCount extends ColumnReference {
  matchingRowCount: number;
}

/**
 * Get all tables and columns that reference a specific column (reverse FK lookup)
 * - PostgreSQL: Query information_schema
 * - SQLite: Not directly supported (would need to scan all tables)
 */
export const findColumnReferences = (input: {
  referencedSchema: string;
  referencedTable: string;
  referencedColumn: string;
}) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const connectionId = yield* RemoteConnection;
    const { referencedSchema, referencedTable, referencedColumn } = input;

    const output = yield* sql.onDialectOrElse({
      pg: () => {
        const pgRefQuery = sql`
					SELECT
						kcu1.table_schema AS schema,
						kcu1.table_name AS table,
						kcu1.column_name AS column,
						kcu2.column_name AS "referencedColumn",
						kcu1.constraint_name AS "constraintName"
					FROM
						information_schema.key_column_usage kcu1
						LEFT JOIN information_schema.referential_constraints rc ON kcu1.constraint_name = rc.constraint_name
						LEFT JOIN information_schema.key_column_usage kcu2 ON rc.unique_constraint_name = kcu2.constraint_name
					WHERE
						kcu1.constraint_name IN (
							SELECT constraint_name
							FROM information_schema.table_constraints
							WHERE constraint_type = 'FOREIGN KEY'
						)
						AND kcu2.table_schema = ${referencedSchema}
						AND kcu2.table_name = ${referencedTable}
						AND kcu2.column_name = ${referencedColumn}
					ORDER BY
						kcu1.table_name,
						kcu1.column_name
				`;
        const pgRefCompiledQuery = pgRefQuery.compile();
        return pgRefQuery.pipe(
          withQueryLogging({
            type: QueryLogType.RelationshipDiscovery,
            sql: pgRefCompiledQuery[0],
            params: pgRefCompiledQuery[1],
            schema: referencedSchema,
            table: referencedTable,
            level: QueryLogLevel.Trace,
            connectionId,
          }),
        );
      },
      mysql: () => {
        const mysqlRefQuery = referencedSchema
          ? sql`
					SELECT
						kcu.TABLE_SCHEMA AS schema,
						kcu.TABLE_NAME AS table,
						kcu.COLUMN_NAME AS column,
						kcu.REFERENCED_COLUMN_NAME AS referencedColumn,
						kcu.CONSTRAINT_NAME AS constraintName
					FROM information_schema.KEY_COLUMN_USAGE kcu
					WHERE kcu.REFERENCED_TABLE_SCHEMA = ${referencedSchema}
						AND kcu.REFERENCED_TABLE_NAME = ${referencedTable}
						AND kcu.REFERENCED_COLUMN_NAME = ${referencedColumn}
						AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
					ORDER BY kcu.TABLE_NAME, kcu.COLUMN_NAME
				`
          : sql`
					SELECT
						kcu.TABLE_SCHEMA AS schema,
						kcu.TABLE_NAME AS table,
						kcu.COLUMN_NAME AS column,
						kcu.REFERENCED_COLUMN_NAME AS referencedColumn,
						kcu.CONSTRAINT_NAME AS constraintName
					FROM information_schema.KEY_COLUMN_USAGE kcu
					WHERE kcu.REFERENCED_TABLE_SCHEMA = DATABASE()
						AND kcu.REFERENCED_TABLE_NAME = ${referencedTable}
						AND kcu.REFERENCED_COLUMN_NAME = ${referencedColumn}
						AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
					ORDER BY kcu.TABLE_NAME, kcu.COLUMN_NAME
				`;
        const mysqlRefCompiled = mysqlRefQuery.compile();
        return mysqlRefQuery.pipe(
          withQueryLogging({
            type: QueryLogType.RelationshipDiscovery,
            sql: mysqlRefCompiled[0],
            params: mysqlRefCompiled[1],
            schema: referencedSchema,
            table: referencedTable,
            level: QueryLogLevel.Trace,
            connectionId,
          }),
        );
      },
      sqlite: () =>
        Effect.gen(function* () {
          // SQLite: manually scan all tables for foreign keys that reference the target
          const tables = yield* getAvailableTables();
          const results: ColumnReference[] = [];

          for (const tableInfo of tables) {
            const fks = yield* getTableForeignKeys({
              schema: referencedSchema,
              table: tableInfo.name,
            });

            for (const fk of fks) {
              if (
                fk.referenced_table_name === referencedTable &&
                fk.referenced_column_name === referencedColumn
              ) {
                results.push({
                  schema: referencedSchema,
                  table: tableInfo.name,
                  column: fk.column_name,
                  referencedColumn: fk.referenced_column_name,
                  constraintName: fk.constraint_name,
                });
              }
            }
          }

          return results.toSorted((a, b) => {
            if (a.table !== b.table) {
              return a.table.localeCompare(b.table);
            }
            return a.column.localeCompare(b.column);
          });
        }),
      mssql: () => {
        // `table`/`column`/`schema` are reserved-ish in T-SQL — bracket-quoted aliases.
        const query = sql`
					SELECT
						ps.name AS [schema],
						pt.name AS [table],
						pc.name AS [column],
						rc.name AS "referencedColumn",
						fk.name AS "constraintName"
					FROM sys.foreign_keys fk
					JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
					JOIN sys.tables pt ON pt.object_id = fk.parent_object_id
					JOIN sys.schemas ps ON ps.schema_id = pt.schema_id
					JOIN sys.columns pc ON pc.object_id = fkc.parent_object_id AND pc.column_id = fkc.parent_column_id
					JOIN sys.tables rt ON rt.object_id = fk.referenced_object_id
					JOIN sys.schemas rs ON rs.schema_id = rt.schema_id
					JOIN sys.columns rc ON rc.object_id = fkc.referenced_object_id AND rc.column_id = fkc.referenced_column_id
					WHERE rs.name = ${referencedSchema}
						AND rt.name = ${referencedTable}
						AND rc.name = ${referencedColumn}
					ORDER BY pt.name, pc.name
				`;
        const compiled = query.compile();
        return query.pipe(
          withQueryLogging({
            type: QueryLogType.RelationshipDiscovery,
            sql: compiled[0],
            params: compiled[1],
            schema: referencedSchema,
            table: referencedTable,
            level: QueryLogLevel.Trace,
            connectionId,
          }),
        );
      },
      clickhouse: () =>
        // No FKs in ClickHouse — no column references to resolve.
        Effect.succeed([] as Array<ColumnReference>),
      orElse: () => new SqlError({ cause: "Unsupported dialect" }),
    });

    return output as Array<ColumnReference>;
  });

/**
 * Get all tables and columns that reference a specific column with row counts
 * Counts how many rows in each referencing table match the given cell value
 * All COUNT queries execute in parallel for efficiency
 * - PostgreSQL: Query information_schema + dynamic count queries
 * - SQLite: Not directly supported (would need to scan all tables)
 */
export const findColumnReferencesWithCounts = (input: {
  referencedSchema: string;
  referencedTable: string;
  referencedColumn: string;
  cellValue: unknown;
}) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const connectionId = yield* RemoteConnection;
    const { referencedSchema, referencedTable, referencedColumn, cellValue } = input;

    // First get all references
    const references = yield* findColumnReferences({
      referencedSchema,
      referencedTable,
      referencedColumn,
    });

    // Normalize the cell value: treat string "null" or "undefined" as null
    const normalizedCellValue =
      cellValue === undefined || cellValue === null
        ? null
        : typeof cellValue === "string" && (cellValue === "null" || cellValue === "undefined")
          ? null
          : cellValue;

    // Execute all COUNT queries in parallel
    const referencesWithCounts = yield* Effect.all(
      references.map((ref) => {
        const tableRef = sql`${sql(ref.schema)}.${sql(ref.table)}`;
        const column = sql(ref.column);
        return sql.onDialectOrElse({
          pg: () => {
            // Build the count query based on whether value is null
            if (normalizedCellValue === null) {
              const nullQuery = sql<{ count: number }>`
								SELECT COUNT(*) as count
								FROM ${tableRef}
								WHERE ${column} IS NULL
							`;
              const nullQueryCompiled = nullQuery.compile();
              return nullQuery.pipe(
                withQueryLogging({
                  type: QueryLogType.RelationshipCounting,
                  sql: nullQueryCompiled[0],
                  params: nullQueryCompiled[1],
                  schema: ref.schema,
                  table: ref.table,
                  level: QueryLogLevel.Trace,
                  connectionId,
                }),
                Effect.map((rows) => ({
                  ...ref,
                  matchingRowCount: Number(rows[0]?.count ?? 0),
                })),
                Effect.catch(() =>
                  Effect.succeed({
                    ...ref,
                    matchingRowCount: -1,
                  }),
                ),
              );
            }
            const valueQuery = sql<{ count: number }>`
							SELECT COUNT(*) as count
							FROM ${tableRef}
							WHERE ${column} = ${normalizedCellValue}
						`;
            const valueQueryCompiled = valueQuery.compile();
            return valueQuery.pipe(
              withQueryLogging({
                type: QueryLogType.RelationshipCounting,
                sql: valueQueryCompiled[0],
                params: valueQueryCompiled[1],
                schema: ref.schema,
                table: ref.table,
                level: QueryLogLevel.Trace,
                connectionId,
              }),
              Effect.map((rows) => ({
                ...ref,
                matchingRowCount: Number(rows[0]?.count ?? 0),
              })),
              Effect.catch(() =>
                Effect.succeed({
                  ...ref,
                  matchingRowCount: -1,
                }),
              ),
            );
          },
          sqlite: () => {
            // SQLite: execute the count query dynamically
            if (normalizedCellValue === null) {
              const sqliteNullQuery = sql<{ count: number }>`
								SELECT COUNT(*) as count
								FROM ${sql(ref.table)}
								WHERE ${sql(ref.column)} IS NULL
							`;
              const sqliteNullCompiled = sqliteNullQuery.compile();
              return sqliteNullQuery.pipe(
                withQueryLogging({
                  type: QueryLogType.RelationshipCounting,
                  sql: sqliteNullCompiled[0],
                  params: sqliteNullCompiled[1],
                  schema: ref.schema,
                  table: ref.table,
                  level: QueryLogLevel.Trace,
                  connectionId,
                }),
                Effect.map((rows) => ({
                  ...ref,
                  matchingRowCount: Number(rows[0]?.count ?? 0),
                })),
                Effect.catch(() =>
                  Effect.succeed({
                    ...ref,
                    matchingRowCount: -1,
                  }),
                ),
              );
            }
            const sqliteValueQuery = sql<{ count: number }>`
							SELECT COUNT(*) as count
							FROM ${sql(ref.table)}
							WHERE ${sql(ref.column)} = ${normalizedCellValue}
						`;
            const sqliteValueCompiled = sqliteValueQuery.compile();
            return sqliteValueQuery.pipe(
              withQueryLogging({
                type: QueryLogType.RelationshipCounting,
                sql: sqliteValueCompiled[0],
                params: sqliteValueCompiled[1],
                schema: ref.schema,
                table: ref.table,
                level: QueryLogLevel.Trace,
                connectionId,
              }),
              Effect.map((rows) => ({
                ...ref,
                matchingRowCount: Number(rows[0]?.count ?? 0),
              })),
              Effect.catch(() =>
                Effect.succeed({
                  ...ref,
                  matchingRowCount: -1,
                }),
              ),
            );
          },
          mssql: () => {
            // COUNT(*) is portable — mirror the pg shape.
            if (normalizedCellValue === null) {
              const nullQuery = sql<{ count: number }>`
								SELECT COUNT(*) as count
								FROM ${tableRef}
								WHERE ${column} IS NULL
							`;
              const nullQueryCompiled = nullQuery.compile();
              return nullQuery.pipe(
                withQueryLogging({
                  type: QueryLogType.RelationshipCounting,
                  sql: nullQueryCompiled[0],
                  params: nullQueryCompiled[1],
                  schema: ref.schema,
                  table: ref.table,
                  level: QueryLogLevel.Trace,
                  connectionId,
                }),
                Effect.map((rows) => ({
                  ...ref,
                  matchingRowCount: Number(rows[0]?.count ?? 0),
                })),
                Effect.catch(() =>
                  Effect.succeed({
                    ...ref,
                    matchingRowCount: -1,
                  }),
                ),
              );
            }
            const valueQuery = sql<{ count: number }>`
							SELECT COUNT(*) as count
							FROM ${tableRef}
							WHERE ${column} = ${normalizedCellValue}
						`;
            const valueQueryCompiled = valueQuery.compile();
            return valueQuery.pipe(
              withQueryLogging({
                type: QueryLogType.RelationshipCounting,
                sql: valueQueryCompiled[0],
                params: valueQueryCompiled[1],
                schema: ref.schema,
                table: ref.table,
                level: QueryLogLevel.Trace,
                connectionId,
              }),
              Effect.map((rows) => ({
                ...ref,
                matchingRowCount: Number(rows[0]?.count ?? 0),
              })),
              Effect.catch(() =>
                Effect.succeed({
                  ...ref,
                  matchingRowCount: -1,
                }),
              ),
            );
          },
          orElse: () => new SqlError({ cause: "Unsupported dialect" }),
        });
      }),
    );

    return referencesWithCounts;
  });

export type RelationshipCardinality = "one-to-one" | "one-to-many" | "many-to-one" | "many-to-many";

/**
 * Detect the cardinality of a foreign key relationship.
 * - PostgreSQL: Query pg_constraint to check uniqueness
 * - SQLite: Limited support (always returns many-to-one as default)
 *
 * Checks:
 * 1. If the referencing columns have a UNIQUE/PRIMARY KEY constraint → potentially 1:1
 * 2. If the referenced columns are unique (PK of referenced table) → indicates 1:N or 1:1
 * 3. If neither side is unique → M:N (many-to-many)
 *
 * @param isIncomingRelationship - When true, inverts the cardinality perspective
 *   (many-to-one becomes one-to-many and vice versa)
 */
export const getRelationshipCardinality = (input: {
  schema: string;
  table: string;
  columns: string[];
  isIncomingRelationship?: boolean;
}): Effect.Effect<
  RelationshipCardinality,
  SqlError,
  SqlClient.SqlClient | QueryLogger | RemoteConnection
> =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const connectionId = yield* RemoteConnection;
    const { schema, table, columns, isIncomingRelationship } = input;

    if (yield* isDuckDbEngineConnection) {
      // JS-computed from duckdb_constraints() metadata (same checks as the pg
      // CTE): FK-side uniqueness → 1:1 candidate; referenced side PK → N:1.
      const fks = yield* fetchDuckDbForeignKeys(sql, { schema });
      const match = fks.find((fk) => fk.table_name === table && fk.column_name === columns[0]);
      if (!match) return isIncomingRelationship ? "one-to-many" : "many-to-one";

      const constraintCols = yield* sql`
					SELECT tc.table_name, tc.constraint_type, kcu.column_name
					FROM information_schema.table_constraints tc
					JOIN information_schema.key_column_usage kcu
						ON tc.constraint_name = kcu.constraint_name
					 AND tc.table_schema = kcu.table_schema
					WHERE tc.table_schema = ${schema}
						AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')
				`;
      const isConstrained = (tableName: string, columnName: string) =>
        (constraintCols as Array<Record<string, unknown>>).some(
          (row) => row.table_name === tableName && row.column_name === columnName,
        );

      const fkSideUnique = isConstrained(table, match.column_name);
      const referencedIsPk = isConstrained(
        match.referenced_table_name,
        match.referenced_column_name,
      );
      const cardinality: RelationshipCardinality =
        fkSideUnique && referencedIsPk
          ? "one-to-one"
          : !fkSideUnique && referencedIsPk
            ? "many-to-one"
            : fkSideUnique
              ? "one-to-many"
              : "many-to-many";
      void connectionId;
      return isIncomingRelationship && cardinality === "many-to-one" ? "one-to-many" : cardinality;
    }

    const output = yield* sql.onDialectOrElse({
      pg: () => {
        const pgCardQuery = sql<{ cardinality: string }>`
					-- Determine cardinality of FK relationship
					WITH table_oid AS (
						SELECT oid
						FROM pg_class
						WHERE relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = ${schema})
							AND relname = ${table}
					),
					fk_info AS (
						SELECT
							con.oid,
							con.conrelid,
							con.confrelid,
							con.conkey,
							con.confkey
						FROM pg_constraint con
						WHERE con.conrelid = (SELECT oid FROM table_oid)
							AND con.contype = 'f'
					),
					fk_side_unique AS (
						SELECT
							fk.oid,
							COALESCE(
								EXISTS (
									SELECT 1 FROM pg_constraint con2
									WHERE con2.conrelid = fk.conrelid
										AND con2.contype IN ('p', 'u')
										AND con2.conkey = fk.conkey
								),
								false
							) as fk_is_unique
						FROM fk_info fk
					),
					referenced_side_unique AS (
						SELECT
							fk.oid,
							COALESCE(
								EXISTS (
									SELECT 1 FROM pg_constraint con3
									WHERE con3.conrelid = fk.confrelid
										AND con3.contype = 'p'
										AND con3.conkey = fk.confkey
								),
								false
							) as referenced_is_pk
						FROM fk_info fk
					)
					SELECT
						CASE
							WHEN fk_u.fk_is_unique AND ref_u.referenced_is_pk THEN 'one-to-one'
							WHEN NOT fk_u.fk_is_unique AND ref_u.referenced_is_pk THEN 'many-to-one'
							WHEN fk_u.fk_is_unique AND NOT ref_u.referenced_is_pk THEN 'one-to-many'
							ELSE 'many-to-many'
						END as cardinality
					FROM fk_info fk
					JOIN fk_side_unique fk_u ON fk.oid = fk_u.oid
					JOIN referenced_side_unique ref_u ON fk.oid = ref_u.oid
					LIMIT 1
				`;
        const pgCardCompiledQuery = pgCardQuery.compile();
        return pgCardQuery.pipe(
          withQueryLogging({
            type: QueryLogType.RelationshipCardinality,
            sql: pgCardCompiledQuery[0],
            params: pgCardCompiledQuery[1],
            schema,
            table,
            level: QueryLogLevel.Trace,
            connectionId,
          }),
        );
      },
      sqlite: () =>
        Effect.gen(function* () {
          // Get foreign keys for this table
          const fksQuery = sql<PragmaForeignKeyInfo>`
						PRAGMA foreign_key_list("${table}")
					`;
          const fksCompiledQuery = fksQuery.compile();
          const fks = yield* fksQuery.pipe(
            withQueryLogging({
              type: QueryLogType.RelationshipCardinality,
              sql: fksCompiledQuery[0],
              params: fksCompiledQuery[1],
              schema,
              table,
              level: QueryLogLevel.Trace,
              connectionId,
            }),
          );

          // Find the FK that matches our columns
          const matchingFk = fks.find((fk) => fk.from === columns[0]);

          if (!matchingFk) {
            // No matching FK found
            return [{ cardinality: "many-to-one" }];
          }

          // Get table info to check if FK column is a primary key
          const tableInfoQuery = sql<{
            cid: number;
            name: string;
            type: string;
            notnull: number;
            dflt_value: string | null;
            pk: number;
          }>`
					PRAGMA table_info("${table}")
				`;
          const tableInfoCompiledQuery = tableInfoQuery.compile();
          const tableInfo = yield* tableInfoQuery.pipe(
            withQueryLogging({
              type: QueryLogType.SchemaIntrospection,
              sql: tableInfoCompiledQuery[0],
              params: tableInfoCompiledQuery[1],
              schema,
              table,
              level: QueryLogLevel.Trace,
              connectionId,
            }),
          );

          // Check if FK column is the primary key
          const fkColumnInfo = tableInfo.find((col) => col.name === columns[0]);
          const fkIsPrimaryKey = (fkColumnInfo?.pk ?? 0) > 0;

          // Get indexes to check if FK columns are unique (non-primary unique index)
          const indexListQuery = sql<PragmaIndexInfo>`
					PRAGMA index_list("${table}")
				`;
          const indexListCompiledQuery = indexListQuery.compile();
          const indexList = yield* indexListQuery.pipe(
            withQueryLogging({
              type: QueryLogType.SchemaIntrospection,
              sql: indexListCompiledQuery[0],
              params: indexListCompiledQuery[1],
              table,
              level: QueryLogLevel.Trace,
              connectionId,
            }),
          );

          let fkIsUnique = fkIsPrimaryKey; // Primary key is unique

          if (!fkIsUnique) {
            for (const idx of indexList) {
              if (idx.unique === 1 && idx.origin !== "pk") {
                // Check if it's not the primary key index
                const idxColsQuery = sql<{
                  seqno: number;
                  cid: number;
                  name: string;
                }>`
								PRAGMA index_info("${idx.name}")
							`;
                const idxColsCompiledQuery = idxColsQuery.compile();
                const idxCols = yield* idxColsQuery.pipe(
                  withQueryLogging({
                    type: QueryLogType.SchemaIntrospection,
                    sql: idxColsCompiledQuery[0],
                    params: idxColsCompiledQuery[1],
                    schema,
                    table,
                    level: QueryLogLevel.Trace,
                    connectionId,
                  }),
                );

                // Check if this index contains our FK column
                if (idxCols.some((col) => col.name === columns[0])) {
                  fkIsUnique = true;
                  break;
                }
              }
            }
          }

          // Check if referenced columns are the primary key
          const referencedTableInfoQuery = sql<{
            cid: number;
            name: string;
            type: string;
            notnull: number;
            dflt_value: string | null;
            pk: number;
          }>`
					PRAGMA table_info("${matchingFk.table}")
				`;
          const referencedTableInfoCompiledQuery = referencedTableInfoQuery.compile();
          const referencedTableInfo = yield* referencedTableInfoQuery.pipe(
            withQueryLogging({
              type: QueryLogType.SchemaIntrospection,
              sql: referencedTableInfoCompiledQuery[0],
              params: referencedTableInfoCompiledQuery[1],
              table,
              level: QueryLogLevel.Trace,
              connectionId,
            }),
          );

          const referencedIsPk = referencedTableInfo.some(
            (col) => col.name === matchingFk.to && col.pk > 0,
          );

          let cardinality: string = "many-to-one";
          if (fkIsUnique && referencedIsPk) {
            cardinality = "one-to-one";
          } else if (!fkIsUnique && referencedIsPk) {
            cardinality = "many-to-one";
          } else if (fkIsUnique && !referencedIsPk) {
            cardinality = "one-to-many";
          } else {
            cardinality = "many-to-many";
          }

          return [{ cardinality }];
        }),
      mssql: () =>
        Effect.gen(function* () {
          // JS-computed from sys metadata (same checks as the pg CTE). Single-column
          // approximation: composite unique indexes only match via their member columns.
          const fks = yield* getTableForeignKeys({ schema, table });
          const match = fks.find((fk) => fk.column_name === columns[0]);
          if (!match) {
            return [{ cardinality: isIncomingRelationship ? "one-to-many" : "many-to-one" }];
          }

          const indexes = yield* getTableIndexes({ schema, table });
          const fkSideUnique = indexes.some(
            (idx) => idx.column_name === match.column_name && idx.is_unique,
          );
          const refIndexes = yield* getTableIndexes({
            schema: match.referenced_table_schema,
            table: match.referenced_table_name,
          });
          const referencedIsPk = refIndexes.some(
            (idx) => idx.column_name === match.referenced_column_name && idx.is_primary,
          );

          let cardinality: string;
          if (fkSideUnique && referencedIsPk) cardinality = "one-to-one";
          else if (!fkSideUnique && referencedIsPk) cardinality = "many-to-one";
          else if (fkSideUnique) cardinality = "one-to-many";
          else cardinality = "many-to-many";
          void connectionId;
          return [{ cardinality }];
        }),
      clickhouse: () =>
        // No FKs → no relationships → cardinality falls through to the default
        // direction-based result below.
        Effect.succeed([] as Array<{ cardinality: string }>),
      orElse: () => new SqlError({ cause: "Unsupported dialect" }),
    });
    const result = output as Array<{ cardinality: string }>;

    // If no result found, return defaults based on relationship direction
    if (result.length === 0) {
      if (isIncomingRelationship) {
        return "one-to-many";
      }
      return "many-to-one";
    }

    let cardinality = result[0].cardinality as RelationshipCardinality;

    // If this is an incoming relationship, invert the cardinality
    // many-to-one becomes one-to-many and vice versa
    if (isIncomingRelationship) {
      if (cardinality === "many-to-one") {
        cardinality = "one-to-many";
      } else if (cardinality === "one-to-many") {
        cardinality = "many-to-one";
      }
      // one-to-one and many-to-many remain the same
    }

    return cardinality;
  });

/**
 * Fetch row counts for all relationships of a table in a single batch
 * This is more efficient than querying each relationship individually
 * - PostgreSQL: Query with COUNT and WHERE clause
 * - SQLite: Same approach
 */
export const getRelationshipsCounts = (input: {
  schema: string;
  table: string;
  relationships: TableRelationshipInput[];
  rowData: Record<string, unknown>;
}) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient.SqlClient;
    const connectionId = yield* RemoteConnection;
    const { relationships, rowData } = input;

    if (relationships.length === 0) {
      return {};
    }

    // Filter out relationships where the FK value is null
    const validRelationships = relationships.filter((rel) => {
      const filterValue =
        rowData[rel.type === "incoming" ? rel.referencedColumn : rel.referencingColumn];
      const isNullValue =
        filterValue === null || filterValue === undefined || filterValue === "null";
      return !isNullValue;
    });

    // Execute COUNT queries in parallel
    const results = yield* Effect.all(
      validRelationships.map((rel) =>
        Effect.gen(function* () {
          const filterValue =
            rowData[rel.type === "incoming" ? rel.referencedColumn : rel.referencingColumn];
          const tableRef = sql`${sql(rel.referencingSchema)}.${sql(rel.referencingTable)}`;
          const referencingColumn = sql(rel.referencingColumn);
          const referencingTable = sql(rel.referencingTable);

          const count = yield* sql.onDialectOrElse(
            pgSqliteHandlers({
              pg: () => {
                const pgCountQuery = sql<{ count: number }>`
							SELECT COUNT(*) as count
							FROM ${tableRef}
							WHERE ${referencingColumn} = ${String(filterValue)}
						`;
                const pgCountCompiledQuery = pgCountQuery.compile();
                return pgCountQuery.pipe(
                  withQueryLogging({
                    type: QueryLogType.RelationshipCounting,
                    sql: pgCountCompiledQuery[0],
                    params: pgCountCompiledQuery[1],
                    schema: input.schema,
                    table: input.table,
                    level: QueryLogLevel.Trace,
                    connectionId,
                  }),
                  Effect.map((rows) => Number(rows[0]?.count ?? 0)),
                  Effect.catch(() => Effect.succeed(0)),
                );
              },
              sqlite: () => {
                const sqliteCountQuery = sql<{ count: number }>`
							SELECT COUNT(*) as count
							FROM ${referencingTable}
							WHERE ${referencingColumn} = ${String(filterValue)}
						`;
                const sqliteCountCompiledQuery = sqliteCountQuery.compile();
                return sqliteCountQuery.pipe(
                  withQueryLogging({
                    type: QueryLogType.RelationshipCounting,
                    sql: sqliteCountCompiledQuery[0],
                    params: sqliteCountCompiledQuery[1],
                    schema: input.schema,
                    table: input.table,
                    level: QueryLogLevel.Trace,
                    connectionId,
                  }),
                  Effect.map((rows) => Number(rows[0]?.count ?? 0)),
                  Effect.catch(() => Effect.succeed(0)),
                );
              },
              orElse: () => Effect.succeed(0),
            }),
          );

          return {
            constraintName: rel.constraintName,
            count,
          };
        }),
      ),
    );

    // Convert array to object keyed by constraintName
    const result: Record<string, number> = {};
    for (const { constraintName, count } of results) {
      result[constraintName] = count;
    }

    return result;
  });

/**
 * Filter condition for building WHERE clauses
 */
export interface FilterCondition {
  column: string;
  operator:
    | "equals"
    | "not_equals"
    | "contains"
    | "not_contains"
    | "starts_with"
    | "ends_with"
    | "greater_than"
    | "greater_than_or_equal"
    | "less_than"
    | "less_than_or_equal"
    | "is_null"
    | "is_not_null"
    | "in"
    | "not_in"
    | "between";
  value?: string | number | boolean | null | string[];
  inverted?: boolean;
}

/**
 * Query table rows with filtering, pagination, ordering, and joins
 * - PostgreSQL: Uses schema.table notation, ILIKE, ANY/ALL for arrays
 * - SQLite: Uses table only (no schema), LIKE with COLLATE NOCASE, IN for arrays
 */
export const queryTableRows = <TData>(input: {
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
}): Effect.Effect<
  {
    rows: TData[];
    rowCount: number;
    columnList: string[];
    hasNextPage: boolean;
    rowsAffected?: number; // For non-SELECT queries (DELETE, UPDATE, INSERT, etc.)
  },
  SqlError,
  RemoteConnection | QueryLogger | SqlClient.SqlClient
> =>
  Effect.gen(function* () {
    const connectionId = yield* RemoteConnection;
    const sql = yield* SqlClient.SqlClient;
    const {
      limit = 50,
      offset = 0,
      orderBy,
      orderDirection = "asc",
      nullsOrder,
      filters,
      selectedColumns = [],
      excludedColumns = [],
    } = input;

    const defaultSchema = (yield* isDuckDbEngineConnection)
      ? getDialectDefaultSchema(DatabaseDialect.DuckDB)
      : yield* sql.onDialectOrElse({
          pg: () => Effect.succeed(getDialectDefaultSchema(DatabaseDialect.Postgres)),
          mysql: () => Effect.succeed(getDialectDefaultSchema(DatabaseDialect.MySQL)),
          sqlite: () => Effect.succeed(getDialectDefaultSchema(DatabaseDialect.SQLite)),
          mssql: () => Effect.succeed(getDialectDefaultSchema(DatabaseDialect.Mssql)),
          clickhouse: () => Effect.succeed(getDialectDefaultSchema(DatabaseDialect.Clickhouse)),
          orElse: () => new SqlError({ cause: "Unsupported dialect" }),
        });
    const baseSchema = remapSchema(input.schema, defaultSchema);

    const joins = input.joins ?? [];
    const joinsRemapped = remapJoins(joins, defaultSchema);

    // Fetch table columns for proper aliasing when using joins
    // Build list of tables we need columns for
    const tablesToFetch = [{ schema: input.schema, table: input.table }];
    if (joins.length > 0) {
      tablesToFetch.push(...joins.map((j) => ({ schema: j.schema, table: j.table })));
    }

    // TODO cache
    // console.time("fetch columns");
    const columnResults = yield* Effect.all(
      tablesToFetch.map((t) =>
        getTableColumns({ schema: t.schema, table: t.table }).pipe(
          Effect.map((columns) => ({
            schemaTable: formatSchemaTable(t.schema === defaultSchema ? "" : t.schema, t.table),
            tableOnly: t.table,
            columns,
          })),
        ),
      ),
    );
    // console.timeEnd("fetch columns");

    // Generate aliases for joins early so we can use them in columnList
    const joinAliases =
      joins.length > 0
        ? generateJoinAliases(joinsRemapped, input.table, baseSchema)
        : new Map<number, string>();

    // Build a map of table identifiers -> columns with filtering applied
    const tableColumnsMap = buildTableColumnsMap(columnResults, selectedColumns, excludedColumns);

    // Build the final column list for SELECT clause
    const columnList = buildColumnList({
      columnResults,
      baseTable: input.table,
      joins,
      joinAliases,
      tableColumnsMap,
    });

    const baseHasPrimaryKey = (columnResults[0]?.columns ?? []).some((c) => c.primaryKey);
    // System row identity for no-PK tables (no joins — identity is base-table scoped).
    const includeSystemRowId = !baseHasPrimaryKey && joins.length === 0;

    // Get count and rows
    const result = yield* sql.onDialectOrElse({
      pg: () =>
        Effect.gen(function* () {
          // Build WHERE clause (including both main table and join filters)
          const whereClause = buildWhereClauseWithJoins(
            DatabaseDialect.Postgres,
            filters,
            joins.length > 0 ? joinsRemapped : undefined,
            joinAliases,
          );

          // Build JOIN clauses
          const joinClauses = buildJoinSqlClauses(
            joinsRemapped,
            input.schema,
            input.table,
            DatabaseDialect.Postgres,
            joinAliases,
          );

          const countQuery = sql`
						SELECT COUNT(*) as count
						FROM ${sql(input.schema)}.${sql(input.table)}
						${sql.unsafe(joinClauses.length > 0 ? joinClauses.join("\n") : "")}
						${sql.unsafe(whereClause ? `WHERE ${whereClause}` : "")}
					`;

          // Build the SELECT clause with proper aliases for joins
          let selectPart =
            joins.length > 0
              ? buildPgSelectWithJoins(
                  baseSchema,
                  input.table,
                  joinsRemapped,
                  tableColumnsMap,
                  joinAliases,
                )
              : columnList.length > 0 &&
                  columnList.length < (columnResults[0]?.columns.length ?? 999)
                ? columnList.join(", ")
                : "*";

          let resultColumnList = columnList;
          if (includeSystemRowId) {
            const rowIdSelect = (yield* isDuckDbEngineConnection)
              ? `rowid AS "${DADABASE_ROW_ID}"`
              : `ctid::text AS "${DADABASE_ROW_ID}"`;
            selectPart = selectPart === "*" ? `${rowIdSelect}, *` : `${rowIdSelect}, ${selectPart}`;
            resultColumnList = [DADABASE_ROW_ID, ...columnList];
          }

          const orderClause = orderBy
            ? `ORDER BY ${sql(orderBy).value} ${orderDirection.toUpperCase()}${
                nullsOrder ? ` NULLS ${nullsOrder.toUpperCase()}` : ""
              }`
            : "";

          const rowsQuery = sql`
					SELECT ${sql.unsafe(selectPart)}
					FROM ${sql(input.schema)}.${sql(input.table)}
					${sql.unsafe(joinClauses.length > 0 ? joinClauses.join("\n") : "")}
					${sql.unsafe(whereClause ? `WHERE ${whereClause}` : "")}
					${sql.unsafe(orderClause)}
					LIMIT ${limit} OFFSET ${offset}
				`;

          const rowsCompiledQuery = rowsQuery.compile();
          const countCompiledQuery = countQuery.compile();

          const [rows, countResult] = yield* Effect.all([
            rowsQuery.pipe(
              withQueryLogging({
                type: QueryLogType.TableRows,
                sql: rowsCompiledQuery[0],
                params: rowsCompiledQuery[1],
                schema: input.schema,
                table: input.table,
                level: QueryLogLevel.Info,
                connectionId: connectionId,
                meta: { input },
              }),
            ),
            countQuery.pipe(
              withQueryLogging({
                type: QueryLogType.TableCount,
                sql: countCompiledQuery[0],
                params: countCompiledQuery[1],
                schema: input.schema,
                table: input.table,
                level: QueryLogLevel.Trace,
                connectionId: connectionId,
                meta: { input },
              }),
            ),
          ]);
          const rowCount = Number(countResult?.[0]?.count ?? 0);
          return {
            rows: (rows ?? []) as TData[],
            columnList: resultColumnList,
            rowCount,
            hasNextPage: offset + limit < rowCount,
          };
        }),
      mysql: () =>
        Effect.gen(function* () {
          const whereClause = buildWhereClauseWithJoins(
            DatabaseDialect.MySQL,
            filters,
            joins.length > 0 ? joinsRemapped : undefined,
            joinAliases,
          );

          const joinClauses = buildJoinSqlClauses(
            joinsRemapped,
            input.schema,
            input.table,
            DatabaseDialect.MySQL,
            joinAliases,
          );

          const fromTable = input.schema
            ? sql`${sql(input.schema)}.${sql(input.table)}`
            : sql`${sql(input.table)}`;

          const countQuery = sql`
						SELECT COUNT(*) as count
						FROM ${fromTable}
						${sql.unsafe(joinClauses.length > 0 ? joinClauses.join("\n") : "")}
						${sql.unsafe(whereClause ? `WHERE ${whereClause}` : "")}
					`;

          let selectPart =
            joins.length > 0
              ? buildMysqlSelectWithJoins(
                  baseSchema,
                  input.table,
                  joinsRemapped,
                  tableColumnsMap,
                  joinAliases,
                )
              : columnList.length > 0 &&
                  columnList.length < (columnResults[0]?.columns.length ?? 999)
                ? columnList.join(", ")
                : "*";

          let resultColumnList = columnList;
          if (includeSystemRowId) {
            const fingerprintCols =
              columnList.length > 0
                ? columnList
                : (columnResults[0]?.columns.map((c) => c.name) ?? []);
            if (fingerprintCols.length === 0) {
              return yield* Effect.fail(
                new SqlError({
                  cause: "Cannot locate MySQL rows without a primary key or column list",
                }),
              );
            }
            const idSelect = buildMysqlSystemRowIdSelect(fingerprintCols);
            selectPart = selectPart === "*" ? `${idSelect}, *` : `${idSelect}, ${selectPart}`;
            resultColumnList = [DADABASE_ROW_ID, ...columnList];
          }

          const orderClause = orderBy
            ? `ORDER BY ${sql(orderBy).value} ${orderDirection.toUpperCase()}`
            : "";

          const rowsQuery = sql`
					SELECT ${sql.unsafe(selectPart)}
					FROM ${fromTable}
					${sql.unsafe(joinClauses.length > 0 ? joinClauses.join("\n") : "")}
					${sql.unsafe(whereClause ? `WHERE ${whereClause}` : "")}
					${sql.unsafe(orderClause)}
					LIMIT ${limit} OFFSET ${offset}
				`;

          const rowsCompiledQuery = rowsQuery.compile();
          const countCompiledQuery = countQuery.compile();

          const [rows, countResult] = yield* Effect.all([
            rowsQuery.pipe(
              withQueryLogging({
                type: QueryLogType.TableRows,
                sql: rowsCompiledQuery[0],
                params: rowsCompiledQuery[1],
                schema: input.schema,
                table: input.table,
                level: QueryLogLevel.Info,
                connectionId: connectionId,
                meta: { input },
              }),
            ),
            countQuery.pipe(
              withQueryLogging({
                type: QueryLogType.TableCount,
                sql: countCompiledQuery[0],
                params: countCompiledQuery[1],
                schema: input.schema,
                table: input.table,
                level: QueryLogLevel.Trace,
                connectionId: connectionId,
                meta: { input },
              }),
            ),
          ]);
          const rowCount = Number(countResult?.[0]?.count ?? 0);
          return {
            rows: (rows ?? []) as TData[],
            columnList: resultColumnList,
            rowCount,
            hasNextPage: offset + limit < rowCount,
          };
        }),
      sqlite: () =>
        Effect.gen(function* () {
          // Build WHERE clause (including both main table and join filters)
          const whereClause = buildWhereClauseWithJoins(
            DatabaseDialect.SQLite,
            filters,
            joins.length > 0 ? joinsRemapped : undefined,
            joinAliases,
          );

          // Build JOIN clauses
          const joinClauses = buildJoinSqlClauses(
            joinsRemapped,
            input.schema,
            input.table,
            DatabaseDialect.SQLite,
            joinAliases,
          );

          const countQuery = sql`
						SELECT COUNT(*) as count
						FROM ${sql(input.table)}
						${sql.unsafe(joinClauses.length > 0 ? joinClauses.join("\n") : "")}
						${sql.unsafe(whereClause ? `WHERE ${whereClause}` : "")}
					`;

          // Build the SELECT clause with proper aliases for joins
          let selectPart =
            joins.length > 0
              ? buildSqliteSelectWithJoins(input.table, joinsRemapped, tableColumnsMap, joinAliases)
              : columnList.length > 0 &&
                  columnList.length < (columnResults[0]?.columns.length ?? 999)
                ? columnList.join(", ")
                : "*";

          let resultColumnList = columnList;
          if (includeSystemRowId) {
            selectPart =
              selectPart === "*"
                ? `rowid AS "${DADABASE_ROW_ID}", *`
                : `rowid AS "${DADABASE_ROW_ID}", ${selectPart}`;
            resultColumnList = [DADABASE_ROW_ID, ...columnList];
          }

          const orderClause = orderBy
            ? `ORDER BY ${sql(orderBy).value} ${orderDirection.toUpperCase()}${
                nullsOrder ? ` NULLS ${nullsOrder.toUpperCase()}` : ""
              }`
            : "";

          const rowsQuery = sql`
					SELECT ${sql.unsafe(selectPart)}
					FROM ${sql(input.table)}
					${sql.unsafe(joinClauses.length > 0 ? joinClauses.join("\n") : "")}
					${sql.unsafe(whereClause ? `WHERE ${whereClause}` : "")}
					${sql.unsafe(orderClause)}
					LIMIT ${limit} OFFSET ${offset}
				`;

          const rowsCompiledQuery = rowsQuery.compile();
          const countCompiledQuery = countQuery.compile();

          const [rows, countResult] = yield* Effect.all([
            rowsQuery.pipe(
              withQueryLogging({
                type: QueryLogType.TableRows,
                sql: rowsCompiledQuery[0],
                params: rowsCompiledQuery[1],
                schema: input.schema,
                table: input.table,
                level: QueryLogLevel.Info,
                connectionId: connectionId,
                meta: { input },
              }),
            ),
            countQuery.pipe(
              withQueryLogging({
                type: QueryLogType.TableCount,
                sql: countCompiledQuery[0],
                params: countCompiledQuery[1],
                schema: input.schema,
                table: input.table,
                level: QueryLogLevel.Trace,
                connectionId: connectionId,
                meta: { input },
              }),
            ),
          ]);
          const rowCount = Number(countResult[0]?.count ?? 0);

          return {
            rows: rows as TData[],
            columnList: resultColumnList,
            rowCount,
            hasNextPage: offset + limit < rowCount,
          };
        }),
      mssql: () =>
        Effect.gen(function* () {
          // T-SQL paging is ORDER BY + OFFSET/FETCH — ORDER BY is mandatory.
          const whereClause = buildWhereClauseWithJoins(
            DatabaseDialect.Mssql,
            filters,
            joins.length > 0 ? joinsRemapped : undefined,
            joinAliases,
          );

          const joinClauses = buildJoinSqlClauses(
            joinsRemapped,
            input.schema,
            input.table,
            DatabaseDialect.Mssql,
            joinAliases,
          );

          const countQuery = sql`
						SELECT COUNT(*) as count
						FROM ${sql(input.schema)}.${sql(input.table)}
						${sql.unsafe(joinClauses.length > 0 ? joinClauses.join("\n") : "")}
						${sql.unsafe(whereClause ? `WHERE ${whereClause}` : "")}
					`;

          let selectPart =
            joins.length > 0
              ? buildPgSelectWithJoins(
                  baseSchema,
                  input.table,
                  joinsRemapped,
                  tableColumnsMap,
                  joinAliases,
                )
              : columnList.length > 0 &&
                  columnList.length < (columnResults[0]?.columns.length ?? 999)
                ? columnList.join(", ")
                : "*";

          let resultColumnList = columnList;
          if (includeSystemRowId) {
            // No physical row id exposed to DML on MSSQL — hash all columns like MySQL.
            const fingerprintCols =
              columnList.length > 0
                ? columnList
                : (columnResults[0]?.columns.map((c) => c.name) ?? []);
            if (fingerprintCols.length === 0) {
              return yield* Effect.fail(
                new SqlError({
                  cause: "Cannot locate SQL Server rows without a primary key or column list",
                }),
              );
            }
            const idSelect = buildMssqlSystemRowIdSelect(fingerprintCols);
            selectPart = selectPart === "*" ? `${idSelect}, *` : `${idSelect}, ${selectPart}`;
            resultColumnList = [DADABASE_ROW_ID, ...columnList];
          }

          // T-SQL has no NULLS FIRST/LAST — nullsOrder is ignored here (documented gap).
          const orderClause = orderBy
            ? `ORDER BY ${sql(orderBy).value} ${orderDirection.toUpperCase()}`
            : "ORDER BY (SELECT NULL)";

          const rowsQuery = sql`
					SELECT ${sql.unsafe(selectPart)}
					FROM ${sql(input.schema)}.${sql(input.table)}
					${sql.unsafe(joinClauses.length > 0 ? joinClauses.join("\n") : "")}
					${sql.unsafe(whereClause ? `WHERE ${whereClause}` : "")}
					${sql.unsafe(orderClause)}
					OFFSET ${offset} ROWS FETCH NEXT ${limit} ROWS ONLY
				`;

          const rowsCompiledQuery = rowsQuery.compile();
          const countCompiledQuery = countQuery.compile();

          const [rows, countResult] = yield* Effect.all([
            rowsQuery.pipe(
              withQueryLogging({
                type: QueryLogType.TableRows,
                sql: rowsCompiledQuery[0],
                params: rowsCompiledQuery[1],
                schema: input.schema,
                table: input.table,
                level: QueryLogLevel.Info,
                connectionId: connectionId,
                meta: { input },
              }),
            ),
            countQuery.pipe(
              withQueryLogging({
                type: QueryLogType.TableCount,
                sql: countCompiledQuery[0],
                params: countCompiledQuery[1],
                schema: input.schema,
                table: input.table,
                level: QueryLogLevel.Trace,
                connectionId: connectionId,
                meta: { input },
              }),
            ),
          ]);
          const rowCount = Number(countResult?.[0]?.count ?? 0);
          return {
            rows: (rows ?? []) as TData[],
            columnList: resultColumnList,
            rowCount,
            hasNextPage: offset + limit < rowCount,
          };
        }),
      clickhouse: () =>
        Effect.gen(function* () {
          // Standard LIMIT/OFFSET works; NULLS FIRST/LAST is not supported
          // (nullsOrder ignored — documented gap). No system row id is injected:
          // ClickHouse connections are read-only, so row targeting never happens.
          const whereClause = buildWhereClauseWithJoins(
            DatabaseDialect.Clickhouse,
            filters,
            joins.length > 0 ? joinsRemapped : undefined,
            joinAliases,
          );

          if (joins.length > 0) {
            // No FKs exist on ClickHouse, so the UI cannot offer joins; fail loudly
            // if one ever arrives instead of emitting dialect-fragile SQL.
            return yield* Effect.fail(
              new SqlError({
                cause: null,
                message: "Joins are not supported for ClickHouse connections",
              }),
            );
          }

          const countQuery = sql`
						SELECT COUNT(*) as count
						FROM ${sql(input.schema)}.${sql(input.table)}
						${sql.unsafe(whereClause ? `WHERE ${whereClause}` : "")}
					`;

          const selectPart =
            columnList.length > 0 && columnList.length < (columnResults[0]?.columns.length ?? 999)
              ? columnList.join(", ")
              : "*";

          const orderClause = orderBy
            ? `ORDER BY ${sql(orderBy).value} ${orderDirection.toUpperCase()}`
            : "";

          const rowsQuery = sql`
					SELECT ${sql.unsafe(selectPart)}
					FROM ${sql(input.schema)}.${sql(input.table)}
					${sql.unsafe(whereClause ? `WHERE ${whereClause}` : "")}
					${sql.unsafe(orderClause)}
					LIMIT ${limit} OFFSET ${offset}
				`;

          const rowsCompiledQuery = rowsQuery.compile();
          const countCompiledQuery = countQuery.compile();

          const [rows, countResult] = yield* Effect.all([
            rowsQuery.pipe(
              withQueryLogging({
                type: QueryLogType.TableRows,
                sql: rowsCompiledQuery[0],
                params: rowsCompiledQuery[1],
                schema: input.schema,
                table: input.table,
                level: QueryLogLevel.Info,
                connectionId,
                meta: { input },
              }),
            ),
            countQuery.pipe(
              withQueryLogging({
                type: QueryLogType.TableCount,
                sql: countCompiledQuery[0],
                params: countCompiledQuery[1],
                schema: input.schema,
                table: input.table,
                level: QueryLogLevel.Trace,
                connectionId,
                meta: { input },
              }),
            ),
          ]);
          const rowCount = Number(countResult?.[0]?.count ?? 0);
          return {
            rows: (rows ?? []) as TData[],
            columnList,
            rowCount,
            hasNextPage: offset + limit < rowCount,
          };
        }),
      orElse: () => new SqlError({ cause: "Unsupported dialect" }),
    });

    return result;
  });
/**
 * Execute custom SQL and return results
 * For SELECT queries: returns rows with column list
 * For other queries (INSERT, UPDATE, DELETE): returns rows affected
 */
export const executeCustomSql = (input: {
  sql: string;
  connectionId?: string;
  /** Audit S2: honor the user's record-history preference. */
  skipQueryLog?: boolean;
}): Effect.Effect<
  {
    rows: unknown[];
    columns: string[];
    rowCount: number;
    rowsAffected?: number;
    timeTaken: number;
    ranAt: number;
  },
  SqlError,
  RemoteConnection | QueryLogger | SqlClient.SqlClient
> =>
  Effect.gen(function* () {
    const connectionId = yield* RemoteConnection;
    const sql = yield* SqlClient.SqlClient;

    const startTime = Date.now();

    const conn = yield* Effect.orDie(sql.reserve).pipe(Effect.scoped);
    const rawExecute = conn.executeRaw(input.sql, []);
    const rawResult = yield* (input.skipQueryLog
      ? rawExecute
      : rawExecute.pipe(
          withQueryLogging({
            type: QueryLogType.TableRows,
            sql: input.sql,
            params: [],
            level: QueryLogLevel.Info,
            connectionId: connectionId,
            meta: { customQuery: true },
          }),
        ));

    // oxlint-disable-next-line unicorn/no-useless-fallback-in-spread
    const result = { rows: [], ...((rawResult as any) ?? {}) } as {
      columns: string[];
      columnTypes: string[];
      rows: unknown[];
      rowCount?: number;
      rowsAffected?: number;
      affectedRows?: number;
    };

    const endTime = Date.now();

    // Determine if this is a SELECT query to know how to handle the result
    const isSelect = isSelectQuery(input.sql);
    if (isSelect) {
      // For SELECT queries, result is an array of row objects
      const rows = result.rows;
      const columnList = rows && rows.length > 0 ? Object.keys(rows[0] as object) : [];
      return {
        rows: rows,
        columns: columnList,
        rowCount: rows?.length ?? 0,
        timeTaken: endTime - startTime,
        ranAt: startTime,
        rowsAffected: undefined,
      };
    }

    const rowsAffected = result.rowCount ?? result.rowsAffected ?? result.affectedRows ?? 0;

    return {
      rows: [] as unknown[],
      columns: [],
      rowCount: 0,
      rowsAffected: rowsAffected,
      timeTaken: endTime - startTime,
      ranAt: startTime,
    };
  });

/**
 * Run SQLite table-rebuild DDL steps on one reserved connection.
 * Always restores `PRAGMA foreign_keys=ON` even if a mid-script statement fails.
 */
export type SqliteTableRebuildResult = {
  rows: Array<Record<string, string | number | boolean | null>>;
  columns: string[];
  rowCount: number;
  rowsAffected?: number;
  timeTaken: number;
  ranAt: number;
};

export const executeSqliteTableRebuild = (input: {
  statements: readonly string[];
}): Effect.Effect<
  SqliteTableRebuildResult,
  SqlError,
  RemoteConnection | QueryLogger | SqlClient.SqlClient
> =>
  Effect.gen(function* () {
    const connectionId = yield* RemoteConnection;
    const sql = yield* SqlClient.SqlClient;
    const startTime = Date.now();

    if (input.statements.length === 0) {
      return yield* Effect.fail(new SqlError({ cause: "No rebuild statements provided" }));
    }

    yield* Effect.scoped(
      Effect.gen(function* () {
        const conn = yield* Effect.orDie(sql.reserve);

        const body = Effect.gen(function* () {
          yield* conn.executeRaw("PRAGMA foreign_keys=OFF", []);
          for (const statement of input.statements) {
            const trimmed = statement.trim();
            if (!trimmed) continue;
            yield* conn.executeRaw(trimmed, []).pipe(
              withQueryLogging({
                type: QueryLogType.TableRows,
                sql: trimmed,
                params: [],
                level: QueryLogLevel.Info,
                connectionId,
                meta: { sqliteRebuild: true },
              }),
            );
          }
        });

        // Mid-script failures often leave an open transaction; ROLLBACK first so the
        // foreign_keys restore can run on a clean connection (PRAGMA is per-connection).
        yield* body.pipe(
          Effect.ensuring(
            Effect.gen(function* () {
              yield* conn.executeRaw("ROLLBACK", []).pipe(Effect.ignore, Effect.asVoid);
              yield* conn
                .executeRaw("PRAGMA foreign_keys=ON", [])
                .pipe(Effect.ignore, Effect.asVoid);
            }),
          ),
        );
      }),
    );

    const endTime = Date.now();
    return {
      rows: [],
      columns: [],
      rowCount: 0,
      rowsAffected: 0,
      timeTaken: endTime - startTime,
      ranAt: startTime,
    };
  });
