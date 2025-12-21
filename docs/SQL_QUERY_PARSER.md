# SQL Query Parser - Auto-Extract State from Custom SQL

## Overview

When users write custom SQL queries in the "Custom SQL" tab, the system automatically parses the SQL and extracts query state to populate the tab configuration:

- **Filters** (WHERE clause conditions)
- **Sorting** (ORDER BY)
- **Pagination** (LIMIT/OFFSET)
- **Column visibility** (SELECT column list)

This happens automatically and debounced (500ms) as the user types, keeping the tab state in sync with the SQL query.

## Features Supported

### WHERE Clause Parsing

The parser extracts WHERE conditions and converts them to `FilterConditionExpression`:

#### Operators Supported

- **Equality**: `=`, `!=`, `<>`
- **Comparison**: `<`, `>`, `<=`, `>=`
- **NULL checks**: `IS NULL`, `IS NOT NULL`
- **String matching**: `LIKE`, `NOT LIKE` (with `%` wildcards)
  - `LIKE '%value%'` → `contains`
  - `LIKE 'value%'` → `starts_with`
  - `LIKE '%value'` → `ends_with`
- **IN/NOT IN**: `IN ('a', 'b', 'c')`, `NOT IN ('x', 'y')`
- **Logical operators**: `AND` (default) or `OR` (auto-detected based on frequency)

#### Examples

```sql
-- Simple condition
WHERE status = 'active'
-- Parses to: { column: 'status', operator: 'equals', value: 'active' }

-- Multiple conditions with AND (default)
WHERE status = 'active' AND age > 18 AND created_at IS NOT NULL
-- Parses to: 3 conditions with logicalOperator: 'and'

-- Multiple conditions with OR
WHERE status = 'deleted' OR status = 'banned'
-- Parses to: 2 conditions with logicalOperator: 'or'

-- LIKE patterns
WHERE name LIKE '%John%'
-- Parses to: { column: 'name', operator: 'contains', value: 'John' }

-- IN operator
WHERE status IN ('active', 'pending', 'archived')
-- Parses to: { column: 'status', operator: 'in', value: ['active', 'pending', 'archived'] }
```

### ORDER BY Parsing

Extracts the first column and direction from ORDER BY:

```sql
ORDER BY created_at DESC
-- Parses to: { orderBy: 'created_at', orderDirection: 'desc' }

ORDER BY name
-- Parses to: { orderBy: 'name', orderDirection: 'asc' } (default)
```

### LIMIT/OFFSET Parsing

Extracts pagination parameters:

```sql
LIMIT 50 OFFSET 100
-- Parses to: { limit: 50, offset: 100 }

LIMIT 25
-- Parses to: { limit: 25 }

OFFSET 0
-- Parses to: { offset: 0 }
```

### SELECT Column Parsing

Determines hidden columns based on SELECT list:

```sql
SELECT id, name, email FROM users
-- Parses to: { hiddenColumnList: ['age', 'created_at', 'status', ...] }
-- (all columns NOT in SELECT)

SELECT * FROM users
-- No hiddenColumnList (all columns shown)
```

## Implementation Details

### Main Function: `parseSqlQuery()`

```typescript
const result = parseSqlQuery(
  "SELECT * FROM users WHERE status = 'active' ORDER BY created_at DESC LIMIT 50",
  ["id", "name", "email", "status", "created_at"] // availableColumns
);

// Result:
{
  filters: {
    conditions: [{ column: 'status', operator: 'equals', value: 'active' }],
    logicalOperator: 'and'
  },
  orderBy: 'created_at',
  orderDirection: 'desc',
  limit: 50
}
```

### Helper Functions

- `parseWhereClause()` - Parses WHERE clause into conditions array
- `parseCondition()` - Parses a single condition (exported for testing)
- `detectLikeOperator()` - Determines LIKE type from pattern
- `isNumeric()` - Type coercion for values

## Integration with Tab State

When custom SQL changes (debounced 500ms):

```typescript
const onCustomSqlChange = useDebouncedCallback(
  (value: string) => {
    const allAvailableColumns = props.columns.flatMap(
      (tc) => tc.columns.map((c) => c.name)
    );
    const parsedState = parseSqlQuery(value, allAvailableColumns);

    navigate({
      search: (prev) =>
        updateTabState(prev, {
          customSql: value,
          ...parsedState, // Merges filters, orderBy, limit, etc.
        }),
    });
  },
  { wait: 500 },
);
```

This keeps the tab state always in sync with the SQL query, allowing UI components to display correct filters, sorting, and pagination info.

## Edge Cases Handled

- Case-insensitive SQL keywords
- Quoted identifiers: `` `name` ``, `"name"`, `name`
- Numeric vs string value detection
- Whitespace normalization
- Invalid column names (ignored)
- Multiple logical operators (AND/OR preference detection)
- Empty WHERE/ORDER BY/LIMIT clauses (gracefully ignored)
- GROUP BY/HAVING clauses (skipped, not parsed)

## Testing

Comprehensive test suite in `sql-query-parser.test.ts` includes:

- **Simple conditions**: 15+ tests
- **Complex WHERE clauses**: 10+ tests
- **Complete SQL queries**: 15+ tests
- **Edge cases**: 10+ tests
- **Integration scenarios**: 3 real-world queries

Total: 52 tests, all passing

## Limitations

Current parser uses regex-based approach (not full SQL parser):

- Only parses the FIRST ORDER BY column (ignores multiple sort columns)
- Cannot handle subqueries or complex expressions
- Cannot parse GROUP BY or HAVING clauses
- String literals with internal quotes may not parse correctly in all cases
- JOINs and table aliases not supported (columns assumed to be from single table)

For more complex SQL, users should use the existing SQL Editor in the main table view.

## Future Enhancements

1. Support multiple ORDER BY columns
2. Parse GROUP BY aggregations
3. Handle JOINs and table aliases
4. Support subqueries in WHERE
5. Parse HAVING clauses
6. Better string literal handling
