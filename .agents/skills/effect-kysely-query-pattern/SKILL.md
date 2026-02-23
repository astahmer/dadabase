
---
name: effect-kysely-query-pattern
description: Building type-safe SQL queries with EffectKysely, combining Kysely query builder with Effect.ts operations.
---

# Effect.ts + Kysely Query Pattern

Compose SQL queries using Kysely's type-safe builder, then execute within Effect for error handling and dependency injection.

## Quick Template

```typescript
import { Effect } from "effect";
import { KyselyPgDatabase } from "#src/db/postgres/kysely.pg.database.ts";
import { withQueryLogging } from "#src/server/query-logger/with-query-logging.ts";

export const getTableData = (input: { schema: string; table: string }) =>
	Effect.gen(function* () {
		const db = yield* KyselyPgDatabase;

		// Build query
		const query = db
			.selectFrom("my_table")
			.select(["id", "name", "email"])
			.where("status", "=", "active")
			.orderBy("created_at", "desc")
			.limit(50);

		// Execute and get results
		const rows = yield* db.execute(query);

		return { rows, count: rows.length };
	}).pipe(withQueryLogging());
```

**Rules:**
- Access database with `yield* DatabaseService`
- Build query with Kysely methods: `.selectFrom()`, `.where()`, `.orderBy()`, `.limit()`
- Multiple conditions with `.where().where()` (AND) or use `or()`
- Execute with `db.execute(query)`, `db.executeTakeFirst()`, etc.
- Always pipe through `withQueryLogging()` for observability
- Type-safe: schema properties are validated at compile-time

## Execution Methods

```typescript
const db = yield* KyselyPgDatabase;

// Get all rows
const rows = yield* db.execute(query);

// Get first row (strict)
const row = yield* db.executeTakeFirstOrError(query);

// Get first row or undefined
const row = yield* db.executeTakeFirstOrUndefined(query);

// Get raw result
const result = yield* db.executeRaw(query);
```

## Real Examples

- [Query logging queries](../../../../src/server/query-logger/query-logger.kysely.ts)
- [Table introspection](../../../../src/db/postgres/kysely.pg.database.layer.ts)
- [Tests with PGlite](../../../../src/db/effect-kysely.pglite.test.ts)

## Transactions

```typescript
const result = yield* db.transaction((trx) =>
	Effect.gen(function* () {
		yield* trx.execute(insertQuery);
		const updated = yield* trx.execute(updateQuery);
		return updated;
	}),
);
```

## Common Patterns

**Dynamic table names:**
```typescript
const query = db.selectFrom(tableName as any).selectAll();
```

**Filtering with conditions:**
```typescript
let query = db.selectFrom("users").selectAll();
if (filters.status) {
	query = query.where("status", "=", filters.status);
}
```

**Joins:**
```typescript
const query = db
	.selectFrom("orders")
	.innerJoin("customers", "orders.customer_id", "customers.id")
	.select(["orders.id", "customers.name"]);
```


