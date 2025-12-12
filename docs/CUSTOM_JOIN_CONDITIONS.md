# Custom Join Conditions Feature

## Overview

The custom join conditions feature allows users to create joins with complex SQL expressions beyond simple foreign key relationships. This enables sophisticated data relationships using:

- Multiple join conditions combined with AND/OR logic
- NULL checks and type casting
- Function calls and computed expressions
- Mixed foreign key and custom SQL conditions

## Architecture

### Type System

Join conditions use a discriminated union pattern to support two modes:

```typescript
type JoinConditionMode = "standard" | "custom";

interface StandardJoinCondition {
  mode: "standard";
  referencingColumn: string;  // Foreign key column in referencing table
  referencedColumn: string;   // Column in referenced table
}

interface CustomJoinCondition {
  mode: "custom";
  referencingColumn?: string;  // Optional: preserved for mode switching
  referencedColumn?: string;   // Optional: preserved for mode switching
  conditions: string[];        // Array of SQL expressions, combined with AND
}

interface JoinedTable {
  table: string;
  schema: string;
  type: "left" | "inner";
  columns: "all" | string[];
  joinCondition: StandardJoinCondition | CustomJoinCondition;  // Discriminated union
  filters?: QueryFilterType;
}
```

### SQL Generation

**PostgreSQL** (`buildPgJoinClauses`):
```sql
-- Standard mode: FK-based
LEFT JOIN "posts" ON "posts"."user_id" = "public"."users"."id"

-- Custom mode: Multiple conditions
LEFT JOIN "posts" ON "posts"."user_id" = "public"."users"."id" AND "posts"."deleted_at" IS NULL
```

**SQLite** (`buildSqliteJoinClauses`):
```sql
-- Follows same pattern with SQLite quote escaping
LEFT JOIN posts ON posts.user_id = public.users.id AND posts.deleted_at IS NULL
```

**Fallback Logic**:
- If custom conditions array is empty, falls back to standard FK join
- Preserves FK info during mode switching in UI

### UI Components

**JoinedTableRow** (`joined-table-row.tsx`):
- Mode toggle buttons: Standard / Custom SQL
- Conditional rendering: Custom SQL section only shows when mode="custom"
- Dynamic condition input fields with add/remove buttons
- Parent callbacks: `onUpdateJoinConditionMode`, `onUpdateCustomJoinConditions`

**JoinTablesDialog** (`join-tables.dialog.tsx`):
- Passes parent table context (schema, table) to JoinedTableRow
- Wires handlers to state management

### State Management

**useJoinTablesState** (`use-join-tables-state.ts`):
- `updateJoinConditionMode(table, schema, mode)`: Switch between modes
  - Preserves FK info when switching to/from custom
- `updateCustomJoinConditions(table, schema, conditions)`: Update custom expressions
- Maintains backward compatibility with existing standard FK joins

## Usage Examples

### Standard FK Join (Existing Behavior)
```typescript
const joins: JoinedTable[] = [{
  table: "posts",
  schema: "public",
  type: "inner",
  columns: "all",
  joinCondition: {
    mode: "standard",
    referencingColumn: "id",
    referencedColumn: "user_id",
  },
}];
```

### Custom Join with NULL Check
```typescript
const joins: JoinedTable[] = [{
  table: "posts",
  schema: "public",
  type: "left",
  columns: ["title", "published"],
  joinCondition: {
    mode: "custom",
    referencingColumn: "id",      // Preserved for potential switch
    referencedColumn: "user_id",
    conditions: [
      'posts.user_id = public.users.id',
      'posts.deleted_at IS NULL',
    ],
  },
}];
```

### Custom Join with Multiple Conditions
```typescript
const joins: JoinedTable[] = [{
  table: "posts",
  schema: "public",
  type: "inner",
  columns: ["title"],
  joinCondition: {
    mode: "custom",
    conditions: [
      'posts.user_id = public.users.id',
      'posts.published = true',
      'posts.created_at > NOW() - INTERVAL \'1 day\'',
    ],
  },
}];
```

## Implementation Details

### Route Schema Validation

The route state serialization (`routes/connections/$connectionName.tsx`) validates both join condition modes:

```typescript
const StandardJoinConditionSchema = Schema.Struct({
  mode: Schema.Literal("standard"),
  referencingColumn: Schema.String,
  referencedColumn: Schema.String,
}).pipe(Schema.mutable);

const CustomJoinConditionSchema = Schema.Struct({
  mode: Schema.Literal("custom"),
  referencingColumn: Schema.String.pipe(Schema.optional),
  referencedColumn: Schema.String.pipe(Schema.optional),
  conditions: Schema.Array(Schema.String).pipe(Schema.mutable),
}).pipe(Schema.mutable);

const JoinConditionSchema = Schema.Union(
  StandardJoinConditionSchema,
  CustomJoinConditionSchema,
);
```

### Server Function Validation

The query table data server function (`query-table-data.start.ts`) validates incoming join configurations using the same schema structure, ensuring type safety end-to-end.

## Testing

Comprehensive test coverage includes:

1. **Standard mode tests** (existing):
   - FK-based joins with both INNER and LEFT
   - Joins with filters, pagination, ordering
   - Multiple conditions on joined tables

2. **Custom mode tests** (new):
   - Single custom condition
   - Multiple conditions combined with AND
   - NULL checks in custom conditions
   - Fallback to standard when conditions empty
   - Mode switching preserves FK info

All 5 new custom join condition tests pass across both PostgreSQL (pglite) and SQLite (libsql) dialects.

## Future Enhancements

Possible extensions for custom joins:

- **OR Logic**: Support `mode: "or"` for combining conditions with OR
- **Function Calls**: `COALESCE(col1, col2)`, `LOWER(name)` expressions
- **Type Casting**: PostgreSQL `::uuid` casting
- **Expression Builder UI**: Visual query builder for complex conditions instead of free-form SQL
- **SQL Validation**: Server-side validation of custom SQL expressions before execution
- **Template Variables**: Allow parameterized conditions for security/reusability

## Migration Notes

### Backward Compatibility

Existing join configurations using the old `referencingColumn`/`referencedColumn` structure have been migrated to the new `joinCondition` wrapper:

**Before**:
```typescript
{
  table: "posts",
  schema: "public",
  type: "inner",
  columns: "all",
  referencingColumn: "id",
  referencedColumn: "user_id",
}
```

**After**:
```typescript
{
  table: "posts",
  schema: "public",
  type: "inner",
  columns: "all",
  joinCondition: {
    mode: "standard",
    referencingColumn: "id",
    referencedColumn: "user_id",
  },
}
```

All test data has been automatically converted to the new structure.

## Related Files

- **Type definitions**: `src/components/pages/connection-page/join-tables/join-tables.types.ts`
- **SQL generation**: `src/server/introspection/join-builder.ts`, `src/server/introspection/introspection.ts`
- **UI components**: `src/components/pages/connection-page/join-tables/joined-table-row.tsx`
- **State management**: `src/components/pages/connection-page/join-tables/use-join-tables-state.ts`
- **Route schema**: `src/routes/connections/$connectionName.tsx`
- **Server validation**: `src/server/introspection/start-fns/query-table-data.start.ts`
- **Tests**: `src/server/introspection/query-table-data.test.ts`
