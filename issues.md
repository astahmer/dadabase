## Tanstack Table:

`table.getColumn(id)` says it can return `undefined` but logs an error if it's not found.

https://github.com/TanStack/table/discussions/5505 / https://github.com/TanStack/table/pull/5964

---

## ArkUI:

1. component contexts are strict and not directly exported so if you want to detect if a component is inside a dialog or not, you need to try/catch the context hook:

```ts
const useDialogContext = () => {
  try {
    return useArkDialogContext();
  } catch {
    return;
  }
};
```

2. Splitter `isPanelExpanded` throws an error if the panel is not found, so you need to wrap it in a try/catch:

```ts
let isPanelExpanded = false;
try {
  isPanelExpanded = ctx.isPanelExpanded("relationships");
} catch {}
```
