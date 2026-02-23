
---
name: effect-service-pattern
description: Creating injectable services with Effect.Service<T>() for dependency injection and composable layers.
---

# Effect.ts Service Pattern

Define reusable injectable services for common functionality. Services are composed into layers and provided to Effect programs.

## Quick Template

```typescript
import { Effect } from "effect";

export class MyService extends Effect.Service<MyService>()("MyService", {
	succeed: {
		method1: (arg: string) => `result: ${arg}`,
		method2: (num: number) => Effect.sync(() => num * 2),
	},
}) {}

// Usage in Effect program
const program = Effect.gen(function* () {
	const service = yield* MyService;
	const result = service.method1("test");
	const asyncResult = yield* service.method2(5);
	return { result, asyncResult };
});
```

**Rules:**
- Class extends `Effect.Service<ClassName>()()`
- First string is unique identifier (namespace convention: `"@app/ServiceName"`)
- `succeed` object contains methods/values
- Async operations return `Effect.Effect<T>`
- Sync operations can be wrapped with `Effect.sync()`
- Access in effects with `yield* ServiceName`

## Real Examples

- [NanoId service](../../../../src/server/services/nano-id.ts) - ID generation
- [QueryLogger service](../../../../src/server/query-logger/query-logger.ts) - Logging
- [DatabaseConnectionRepository](../../../../src/db/database-connection.repository.ts) - Database operations

## Workflow: Create & Use

1. **Define service** with `Effect.Service<T>()`
2. **Create layer** with `Layer.succeed()` to provide an implementation
3. **Compose** into app runtime with `Layer.mergeAll()`
4. **Access** in effects with `yield* ServiceName`
5. **Override** for testing with mock implementations

## Testing

Use `Layer.succeed()` to provide test implementations:
```typescript
const MockService = Layer.succeed(
	MyService,
	new MyService({ method1: () => "mock" }),
);
```


