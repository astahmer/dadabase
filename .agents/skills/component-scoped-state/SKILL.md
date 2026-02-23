
---
name: component-scoped-state
description: Organizing component-specific hooks, state, and utilities in the same folder as the component.
---

# Component-Scoped State & Hooks

Feature-specific hooks, formatting functions, and actions belong in the component folder, NOT in generic `hooks/` or `lib/`.

## Quick Template

```
components/pages/my-feature/
  ├── my-feature.tsx                    # Main component
  ├── use-my-feature-state.tsx          # State management hook
  ├── use-my-feature-state.actions.ts   # Actions for reducer
  ├── use-my-data.ts                    # Data fetching hook
  ├── format-my-value.ts                # Formatting utilities
  └── my-feature.styles.ts              # Variants with CVA
```

**Rules:**
- Files colocated in component folder
- State hooks: `use-FeatureName-state.tsx`
- Actions/reducers: `use-FeatureName-state.actions.ts`
- Formatting: `format-ValueType.ts`
- Styles: `FeatureName.styles.ts` with `cva()`
- Only move to `hooks/` if truly generic (zero feature-specific code)
- Only move to `lib/` if truly reusable and framework-agnostic

## Bad vs Good Examples

❌ **Bad**: Generic `hooks/` folder
```typescript
// hooks/use-table-sorting.ts - too specific to table feature
export const useTableSorting = (tableName: string) => { ... }
```

✅ **Good**: Component folder
```typescript
// components/data-table/use-table-sorting.ts
export const useTableSorting = (tableName: string) => { ... }
```

✅ **Good**: Generic `hooks/` folder
```typescript
// hooks/use-local-storage.ts - works anywhere
export const useLocalStorage = (key: string) => { ... }
```

## Real Examples

- [Connection page state](../../../../src/components/pages/connection-page/use-connection-page-state.tsx)
- [Row/column management](../../../../src/components/pages/connection-page/use-rows-columns.tsx)
- [Relationships state](../../../../src/components/pages/connection-page/relationships/)
