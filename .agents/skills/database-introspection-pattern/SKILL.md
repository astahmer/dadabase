
---
name: database-introspection-pattern
description: Querying database metadata (tables, columns, schemas) from connected PostgreSQL or SQLite instances.
---

# Database Introspection Pattern

Dynamically fetch table and column information from connected databases using standard SQL queries.

## Quick Template

```typescript
import { Effect } from "effect";
import { RemoteConnection } from "#src/server/db-connection/remote-connection.tag.ts";
import { SqlClient } from "@effect/sql";

// Get available schemas
export const getAvailableSchemas = () =>
	Effect.gen(function* () {
		const db = yield* RemoteConnection;
		const schemas = yield* db.sql<{ name: string }>`
			SELECT schema_name as name
			FROM information_schema.schemata
			WHERE schema_name NOT IN ('pg_catalog', 'information_schema')
		`;
		return schemas;
	});

// Get tables in schema
export const getTableList = (schema: string) =>
	Effect.gen(function* () {
		const db = yield* RemoteConnection;
		const tables = yield* db.sql<{ name: string }>`
			SELECT table_name as name
			FROM information_schema.tables
			WHERE table_schema = ${schema}
		`;
		return tables;
	});

// Get columns for table
export const getTableColumns = (schema: string, table: string) =>
	Effect.gen(function* () {
		const db = yield* RemoteConnection;
		const columns = yield* db.sql<{
			name: string;
			type: string;
			nullable: boolean;
		}>`
			SELECT
				column_name as name,
				data_type as type,
				is_nullable = 'YES' as nullable
			FROM information_schema.columns
			WHERE table_schema = ${schema} AND table_name = ${table}
		`;
		return columns;
	});
```

**Rules:**
- Use `RemoteConnection` service to access connected database
- Query `information_schema.` tables (PostgreSQL standard)
- Filter out system schemas: `pg_catalog`, `information_schema`
- Return typed results: `db.sql<{ field: type }>`*
- Wrap queries with `withQueryLogging()` at call site

## Dialect Differences

PostgreSQL uses `information_schema.*`, SQLite uses `PRAGMA`:

```typescript
// PostgreSQL
SELECT schema_name FROM information_schema.schemata;

// SQLite
PRAGMA database_list;  // Get attached databases
PRAGMA table_list;     // Get tables
PRAGMA table_info(table_name);  // Get columns
```

## Real Examples

- [Available schemas](../../../../src/server/introspection/introspection.ts) - query schemas
- [Available tables](../../../../src/server/introspection/introspection.ts) - list tables
- [Table columns](../../../../src/server/introspection/introspection.ts) - column details
- [Foreign keys](../../../../src/server/pg/fns/get-table-foreign-keys.kysely.ts) - relationships

## Caching Strategy

Metadata is often cached during a connection session:
```typescript
const metadata = useQuery({
	...getTableColumnsQueryOptions({ schema, table }),
	staleTime: 5 * 60 * 1000, // 5 min cache
});
```

## Foreign Keys (PostgreSQL)

```typescript
const fks = yield* db.sql<{
	constraintName: string;
	fromTable: string;
	fromColumn: string;
	toTable: string;
	toColumn: string;
}>`
	SELECT
		constraint_name,
		table_name as from_table,
		column_name as from_column,
		foreign_table_name as to_table,
		foreign_column_name as to_column
	FROM information_schema.key_column_usage
	WHERE constraint_type = 'FOREIGN KEY'
		AND table_schema = ${schema}
`;
```


