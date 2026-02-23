
---
name: context-tag-dependency-injection
description: Using Context.Tag for typed dependency injection to access services and resources.
---

# Context.Tag Pattern for Dependency Injection

Define and access dependencies using `Context.Tag` for type-safe, compile-time checked dependency resolution.

## Quick Template

```typescript
import { Context, Effect } from "effect";

// Define tag for database service
export class AppDatabase extends Context.Tag("@app/Database")<
	AppDatabase,
	DatabaseClient
>() {}

// Define tag for configuration
export class Config extends Context.Tag("@app/Config")<
	Config,
	{ apiUrl: string; logLevel: string }
>() {}

// Use in Effect program
const program = Effect.gen(function* () {
	// Access dependencies via yield*
	const db = yield* AppDatabase;
	const config = yield* Config;

	// Use them
	const result = yield* db.query("SELECT * FROM users");
	console.log(config.apiUrl);

	return result;
});

// Provide dependencies
const runProgram = program.pipe(
	Effect.provideLayer(
		Layer.mergeAll(
			Layer.succeed(AppDatabase, new DatabaseClient()),
			Layer.succeed(Config, { apiUrl: "http://...", logLevel: "info" }),
		),
	),
);
```

**Rules:**
- `Context.Tag` defines a named dependency
- First generic is the tag class itself
- Second generic is the type of value
- Access with `yield* TagName`
- Must be provided before execution
- Type-safe: compiler knows all available dependencies

## Tag Naming Convention

```typescript
// Namespace-style naming
export class AppDatabase extends Context.Tag("@dadabase/Database")<...>() {}
export class QueryLogger extends Context.Tag("@dadabase/QueryLogger")<...>() {}

// Descriptive naming
export class RemoteConnection extends Context.Tag("@dadabase/RemoteConnection")<
	RemoteConnection,
	SqlClient
>() {}
```

## Providing Dependencies

```typescript
import { Context, Effect, Layer } from "effect";

// Define tags
export class ServiceA extends Context.Tag("ServiceA")<ServiceA, string>() {}
export class ServiceB extends Context.Tag("ServiceB")<ServiceB, number>() {}

// Create layers
const layerA = Layer.succeed(ServiceA, "value-a");
const layerB = Layer.succeed(ServiceB, 42);

// Provide all at once
const program = Effect.gen(function* () {
	const a = yield* ServiceA;
	const b = yield* ServiceB;
	return { a, b };
}).pipe(
	Effect.provideLayer(Layer.mergeAll(layerA, layerB)),
);
```

## Dependency on Other Tags

```typescript
// ServiceB depends on ServiceA
const layerB = Layer.effect(
	ServiceB,
	Effect.gen(function* () {
		const a = yield* ServiceA;
		// Use ServiceA to create ServiceB
		return a.length; // example: get string length
	}),
);

// Provide in correct order (or automatically resolved)
const program = Effect.gen(function* () {
	const b = yield* ServiceB;  // ServiceA provided automatically
}).pipe(
	Effect.provideLayer(Layer.mergeAll(layerA, layerB)),
);
```

## Real Examples

- [AppDatabase tag](../../../../src/db/app.db.ts) - Database access
- [RemoteConnection tag](../../../../src/server/db-connection/remote-connection.tag.ts) - Connected database
- [QueryLogger tag](../../../../src/server/query-logger/query-logger.ts) - Query logging
- [NanoId service](../../../../src/server/services/nano-id.ts) - ID generation (uses Effect.Service)

## Testing with Mocks

```typescript
// Production code
const program = Effect.gen(function* () {
	const db = yield* AppDatabase;
	const users = yield* db.query("SELECT * FROM users");
	return users;
});

// Test with mock
const mockDb = {
	query: () => Effect.succeed([{ id: 1, name: "test" }]),
};

const testProgram = program.pipe(
	Effect.provideLayer(
		Layer.succeed(AppDatabase, mockDb),
	),
);

// Execute test
const result = await Effect.runPromise(testProgram);
```

## Difference: Context.Tag vs Effect.Service

```typescript
// Effect.Service - defines service methods
export class MyService extends Effect.Service<MyService>()("MyService", {
	succeed: {
		method1: () => "result",
		method2: (x: number) => x * 2,
	},
}) {}

// Context.Tag - just a typed reference to a value/dependency
export class Config extends Context.Tag("Config")<Config, {
	apiUrl: string;
}>() {}

// Both used same way:
const program = Effect.gen(function* () {
	const service = yield* MyService;
	const config = yield* Config;
});
```

## Accessing Nested Properties

```typescript
export class AppConfig extends Context.Tag("AppConfig")<
	AppConfig,
	{
		database: { url: string; pool: number };
		server: { port: number};
	}
>() {}

const program = Effect.gen(function* () {
	const config = yield* AppConfig;
	const dbUrl = config.database.url;  // Type-safe access
	const port = config.server.port;

	return { dbUrl, port };
});
```

## Error: Tag Not Provided

```typescript
// Runtime error if dependency not provided
const program = Effect.gen(function* () {
	const db = yield* AppDatabase;  // Error: AppDatabase not in context
	return db;
});

const result = Effect.runSync(program);
// Error: "Context is missing required service AppDatabase"
```

## Providing Multiple Implementations

```typescript
// Test environment
const testLayer = Layer.succeed(AppDatabase, mockDatabase);

// Production environment
const prodLayer = Layer.effect(
	AppDatabase,
	Effect.gen(function* () {
		const config = yield* AppConfig;
		return new PgDatabase(config.database.url);
	}),
);

// Choose at runtime
const layer = isProd ? prodLayer : testLayer;
```


