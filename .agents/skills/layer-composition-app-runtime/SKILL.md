
---
name: layer-composition-app-runtime
description: Composing Effect layers and creating app runtime for dependency injection at startup.
---

# Layer Composition & App Runtime

Combine Effect layers to wire dependencies and create runtime for executing Effect programs.

## Quick Template

```typescript
import { Layer, ManagedRuntime } from "effect";
import { Service1 } from "./service-1.ts";
import { Service2 } from "./service-2.ts";
import { DatabaseLayer } from "#src/db/app.db.live.ts";

// Compose all service layers
const AppLayer = Layer.mergeAll(
	Service1.Default,    // Service with default implementation
	Service2.Layer,      // Custom layer
	DatabaseLayer,
);

// Add database layer with providers
const AppWithDbLayer = AppLayer.pipe(
	Layer.provideMerge(makeAppDatabaseLayerFromEnv),
);

// Create runtime for executing programs
export const AppRuntime = ManagedRuntime.make(AppWithDbLayer);
```

**Rules:**
- Use `Layer.mergeAll()` to combine multiple layers
- Use `Layer.provideMerge()` to provide dependencies to layers
- Create `ManagedRuntime.make()` once at app startup
- Use `runtime.runPromise()` or `runtime.runSync()` to execute programs
- Each service must be available in composed layers
- Order matters: dependencies must be provided before use

## Creating Service Layers

```typescript
// Service with Default implementation
export class MyService extends Effect.Service<MyService>()("MyService", {
	succeed: {
		method: () => "result",
	},
}) {}

// Layer making it available
const MyServiceLayer = Layer.succeed(
	MyService,
	new MyService({
		method: () => "result",
	}),
);

// Or effect-based layer
const MyServiceLayer = Layer.effect(
	MyService,
	Effect.gen(function* () {
		const config = yield* ConfigProvider;
		return new MyService({
			method: () => config.getValue(),
		});
	}),
);
```

## Composing Complex Layers

```typescript
// Individual layers
const DatabaseLayer = Layer.effect(
	AppDatabase,
	makeAppDatabase(),
);

const CacheLayer = Layer.effect(
	CacheService,
	makeCache(),
);

const LoggerLayer = Logger.pretty.pipe(
	Logger.minimumLogLevel(LogLevel.Info),
);

// Compose together
const AppLayer = Layer.mergeAll(
	DatabaseLayer,
	CacheLayer,
	LoggerLayer,
	OtherServices,
);

// Provide environment and create runtime
export const AppRuntime = ManagedRuntime.make(
	AppLayer.pipe(
		Layer.provideMerge(PlatformContext.layer),
		Layer.provideMerge(DotEnvProvider),
	),
);
```

## Real Example

[App Runtime](../../../../src/server/services/app.runtime.ts)

```typescript
const AppLayer = Layer.mergeAll(
	DatabaseConnectionRepository.Default,
	CustomSqlExecutionRepository.Default,
	NanoId.Default,
	DotEnvProvider,
	makePoolCacheLive,
);

export const AppRuntime = ManagedRuntime.make(
	AppLayer.pipe(Layer.provideMerge(makeAppDatabaseLayerFromEnv)),
);
```

## Using Runtime

```typescript
// Server function
export const getDataServerFn = createServerFn(
	{ method: "GET" },
	async (input: InputType) => {
		// AppRuntime already has all layers built-in
		return AppRuntime.runSync(myEffectProgram(input));
	},
);

// After: no need to manually provide layers in each call
```

## Dependency Order

Layers can depend on other layers. Provide dependencies first:

```typescript
// This works: Service2Layer uses Service1
const Service1Layer = Layer.succeed(Service1, ...);
const Service2Layer = Layer.effect(
	Service2,
	Effect.gen(function* () {
		const s1 = yield* Service1;  // Available because below
		// use s1...
	}),
);

const Combined = Layer.mergeAll(
	Service1Layer,  // Provide first
	Service2Layer,  // Uses Service1
);
```

## Testing with Layers

Override layers for testing:

```typescript
const TestLayer = Layer.mergeAll(
	AppLayer,
	// Override specific service for testing
	Layer.succeed(
		DatabaseService,
		new DatabaseService({ /* mock */ }),
	),
);

const testProgram = program.pipe(
	Effect.provideLayer(TestLayer),
);
```

## Environment Variables

Load config from env:

```typescript
import { PlatformConfigProvider } from "@effect/platform";
import { NodeContext } from "@effect/platform-node";

const ConfigLayer = Layer.mergeAll(
	PlatformConfigProvider.layerDotEnvAdd(".env"),
).pipe(Layer.provideMerge(NodeContext.layer));

const AppLayer = Layer.mergeAll(
	OtherServices,
	ConfigLayer,
);
```

## Scoped Resources

Layers manage resource cleanup automatically:

```typescript
const DatabaseLayer = Layer.scoped(
	AppDatabase,
	Effect.gen(function* () {
		const db = yield* Effect.tryPromise(() => connectDb());

		// Cleanup is automatic when runtime shuts down
		yield* Effect.addFinalizer(() =>
			Effect.tryPromise(() => db.close()),
		);

		return db;
	}),
);
```


