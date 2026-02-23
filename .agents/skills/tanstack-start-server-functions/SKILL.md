
---
name: tanstack-start-server-functions
description: Creating server functions with TanStack Start that wrap Effect programs and export query/mutation options.
---

# TanStack Start Server Functions

Bridge between React Query client and Effect.ts backend. Wrap Effect programs in `createServerFn()` and export `queryOptions`/`mutationOptions`.

## Quick Template

```typescript
import { createServerFn } from "@tanstack/start";
import { queryOptions, mutationOptions } from "@tanstack/react-query";
import { appRuntime } from "#src/server/services/app.runtime.ts";
import { myEffectFn } from "./my-effect-fn.ts";

// Server function wrapper
const getMyDataServerFn = createServerFn(
	{ method: "GET" },
	async (input: { id: string }) => {
		return appRuntime.runSync(myEffectFn(input));
	},
);

// Export query options for client usage
export const myDataQueryOptions = (input: { id: string }) =>
	queryOptions({
		queryKey: ["my-data", input.id],
		queryFn: () => getMyDataServerFn(input),
	});

// Mutation example
export const updateMyDataServerFn = createServerFn(
	{ method: "POST" },
	async (input: { id: string; data: string }) => {
		return appRuntime.runSync(updateEffect(input));
	},
);

export const updateMyDataMutation = mutationOptions({
	mutationFn: updateMyDataServerFn,
});
```

**Rules:**
- File suffix: `.start.ts`
- Use `createServerFn({ method })` for HTTP method
- Wrap Effect program with `appRuntime.runSync(effectProgram)`
- Export `queryOptions`/`mutationOptions` from same file
- Use descriptive `queryKey` arrays for validation checks
- Input/output types matter for client type safety

## Real Examples

- [Query server functions](../../../../src/server/introspection/start-fns/query-table-data.start.ts)
- [Connection management](../../../../src/server/db-connection/start-fns/create-db-connection.start.ts)
- [Schema introspection](../../../../src/server/introspection/start-fns/get-available-schemas.start.ts)

## Workflow: Create Effect Fn → Wrap in ServerFn

1. **Create Effect function** in `fns/` folder
2. **Create `.start.ts` file** in `start-fns/` folder
3. **Wrap with `createServerFn()`** and `appRuntime.runSync()`
4. **Export query/mutationOptions** for client
5. **Import in components** and use with `useQuery`/`useMutation`

## Error Handling

Errors thrown by Effect program are serialized to client:
```typescript
// Client receives error details
const { data, error } = useQuery(myDataQueryOptions);
```


