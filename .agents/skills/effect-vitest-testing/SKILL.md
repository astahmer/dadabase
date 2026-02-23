
---
name: effect-vitest-testing
description: Testing Effect.ts programs with Vitest using it.effect() and Effect layers.
---

# Testing with Effect.ts + Vitest

Write type-safe tests for Effect generators and services using `@effect/vitest` and Effect layers.

## Quick Template

```typescript
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";

describe("my effect", () => {
	it.effect("should process data", () =>
		Effect.gen(function* () {
			// Test code here
			const result = yield* Effect.succeed({ value: 42 });
			expect(result).toEqual({ value: 42 });
		}),
	);
});
```

**Rules:**
- Import from `@effect/vitest`, not `vitest`
- Use `it.effect()` instead of `it()` for Effect programs
- Effect generators run automatically
- Return Effect program that yields operations
- Use standard `expect()` assertions
- Run with `pnpm test --run` (avoid watch mode)

## Testing with Services

```typescript
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Context } from "effect";

class TestService extends Context.Tag("TestService")<
	TestService,
	{ getValue: () => number }
>() {}

describe("service", () => {
	const testLayer = Layer.succeed(
		TestService,
		TestService.of({
			getValue: () => 42,
		}),
	);

	it.effect("accesses service", () =>
		Effect.gen(function* () {
			const service = yield* TestService;
			const value = service.getValue();
			expect(value).toBe(42);
		}).pipe(Effect.provideLayer(testLayer)),
	);
});
```

## Testing Database Queries

```typescript
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Context } from "effect";
import { makeEffectKyselyPglite } from "#src/db/effect-kysely.pglite.ts";
import type { EffectKysely } from "#src/db/effect-kysely.ts";

interface TestDb {
	test_table: {
		id: ColumnType<number, number, number>;
		name: ColumnType<string, string, string>;
	};
}

class TestDatabase extends Context.Tag("TestDb")<TestDb, EffectKysely<TestDb>>() {}

const dbLayer = Layer.effect(
	TestDatabase,
	makeEffectKyselyPglite<TestDb>({
		dataDir: "memory://",
		setup: async (qb) => {
			await qb.schema
				.createTable("test_table")
				.addColumn("id", "integer", (col) => col.primaryKey())
				.addColumn("name", "text")
				.execute();
		},
	}),
);

describe("database", () => {
	it.effect("inserts and reads rows", () =>
		Effect.gen(function* () {
			const db = yield* TestDatabase;

			// Insert
			yield* db.execute(
				db.insertInto("test_table")
					.values({ id: 1, name: "test" })
			);

			// Query
			const rows = yield* db.execute(
				db.selectFrom("test_table").selectAll()
			);

			expect(rows).toHaveLength(1);
			expect(rows[0]?.name).toBe("test");
		}),
	).pipe(Layer.provideLayer(dbLayer));
});
```

## Real Examples

- [Query logger tests](../../../../src/server/query-logger/query-logger.layer.test.ts)
- [Database integration tests](../../../../src/db/effect-kysely.pglite.test.ts)
- [Natural language parser tests](../../../../src/lib/natural-language-parser.test.ts)

## Testing Effect Functions

```typescript
// Function to test
const add = (a: number, b: number) =>
	Effect.sync(() => a + b);

// Test
it.effect("adds numbers", () =>
	Effect.gen(function* () {
		const result = yield* add(2, 3);
		expect(result).toBe(5);
	}),
);
```

## Error Testing

```typescript
import { Effect } from "effect";

it.effect("handles errors", () =>
	Effect.gen(function* () {
		// Catch error explicitly
		const result = yield* Effect.either(
			Effect.fail(new Error("test error"))
		);

		expect(result._tag).toBe("Left");
	}),
);

// Or use catchAll
it.effect("catches and recovers", () =>
	Effect.gen(function* () {
		const result = yield* Effect.fail(new Error("oops"))
			.pipe(
				Effect.catchAll(() => Effect.succeed("recovered"))
			);

		expect(result).toBe("recovered");
	}),
);
```

## Layer Composition in Tests

```typescript
// Compose multiple layers
const AppTestLayer = Layer.mergeAll(
	ServiceALayer,
	ServiceBLayer,
	DatabaseLayer,
);

it.effect("uses composed layers", () =>
	Effect.gen(function* () {
		const serviceA = yield* ServiceA;
		const serviceB = yield* ServiceB;
		// Test uses both services
	}).pipe(Effect.provideLayer(AppTestLayer)),
);
```

## Best Practices

- Always use `--run` flag: `pnpm test --run`
- Use `it.only` for debugging single test
- Mock external services with layers
- Use in-memory database for tests
- Be specific with assertions (not `toBeGreaterThanOrEqual(2)`, use `toBe(3)`)
- Isolate tests with separate layers


