# Structured Query Editor with Intelligent Token Suggestions

The Natural Language Search component has been upgraded to use a **state machine-based suggestion system** that provides context-aware recommendations for building queries.

## How It Works

The editor operates like a minimal structured editor with a state machine that tracks what has been typed and suggests only the valid "next tokens" based on the current state.

### States

The query builder recognizes **4 distinct states**:

1. **Empty State** (`empty`)
   - Input is empty
   - Shows all available columns
   - Example: User clicks input, sees `[id, name, email, created_at, age]`

2. **Column State** (`column`)
   - User is typing/selecting a column name
   - Suggestions filter by what's typed (startsWith via fuzzy match)
   - Also shows example operators for that column
   - Example: User types `cre` → shows `[created_at]` with operators like `created_at equals`, `created_at > `, etc.

3. **Operator State** (`operator`)
   - Column selected, now choosing an operator
   - Shows matching operators from: `equals`, `contains`, `>`, `>=`, `<`, `<=`, `!=`
   - Example: User types `name e` → shows `[name equals, ...]`

4. **Value State** (`value`)
   - Column and operator selected, now entering a value
   - Shows contextual example values based on column name
   - Example: After `name equals`, shows example values like `[john, alice, example, test]`

5. **Complete State** (`complete`)
   - A complete condition has been entered
   - Shows additional clauses: `sort by`, `order by`, `limit`, `top`, `first`
   - Example: After `name equals john`, allows chaining with sorting/limiting

### Example User Flow

```
User Flow: Building "age > 25"

1. Click input → Empty state
   Suggestions: [id, name, email, created_at, age, ...]

2. Type "a" → Column state, filtered
   Suggestions: [age, ...]
   Also shows: [age equals, age contains, age >, age >=, ...]

3. Type "ge " → Column matched
   Suggestions: [age equals, age >, age >=, age <, ...]

4. Type "ge > " → Operator state
   Suggestions: [age > value1, age > value2, age > 50, ...]

5. Type "ge > 25" → Complete state
   Suggestions: [sort by, order by, limit, top, first, ...]

6. Select "age > 25" or press Enter
   Query is parsed and applied immediately
```

## Column-Based Example Values

The system intelligently suggests values based on the column name pattern:

| Column Pattern | Example Values |
|---|---|
| `count`, `quantity` | `1, 5, 10, 50, 100` |
| `price`, `cost`, `amount` | `10.99, 50, 100, 500, 1000` |
| `age` | `18, 25, 30, 50` |
| `date`, `time`, `created`, `updated` | `2024-01-01, today, 2024, recent` |
| `name`, `title`, `label` | `john, alice, example, test` |
| `status`, `state` | `active, inactive, pending, completed` |
| `email` | `user@example.com, admin@example.com` |
| `url`, `link` | `https://example.com, http://localhost` |

## Supported Operators

The system recognizes these operators (showing all in suggestions at once):

- `equals` (aliases: `=`, `is`, `eq`)
- `contains` (aliases: `like`, `includes`)
- `>` (alias: `greater than`, `gt`)
- `>=` (alias: `greater than or equal`, `gte`)
- `<` (alias: `less than`, `lt`)
- `<=` (alias: `less than or equal`, `lte`)
- `!=` (aliases: `<>`, `not equal`)

## Implementation Details

### State Analysis (`analyzeQueryState`)

Parses the current input and returns:
- Current state (`empty | column | operator | value | complete`)
- Parsed tokens (column, operator, value)
- Current input being typed

```typescript
const context = analyzeQueryState("name equals ", columns);
// Returns:
// {
//   state: "value",
//   column: "name",
//   operator: "equals",
//   currentInput: "",
//   tokens: [...]
// }
```

### Suggestion Generation (`generateSuggestions`)

Based on current state, generates filtered suggestions:

```typescript
const suggestions = generateSuggestions(context, columns);
// Returns suggestions like:
// [
//   { label: "name equals john", value: "name equals john", type: "value" },
//   { label: "name equals alice", value: "name equals alice", type: "value" },
//   ...
// ]
```

### Fuzzy Matching

Uses `@tanstack/match-sorter-utils` for intelligent filtering:
- `crea` matches `created_at` because it starts with `crea`
- `email` finds `email` before `name` in column list
- Partial matches work via ranking

## UI Components

The component uses Ark UI's `Popover` and `Listbox`:
- **Popover**: Opens on input click/focus to show suggestions
- **Listbox**: Displays suggestions with keyboard navigation support
- **Adaptive Text**: Changes hint text based on state (`"Suggestions for next token"` vs `"Start typing or pick a column"`)

## Benefits Over Previous Implementation

✅ **Progressive Guidance**: Users only see valid next steps
✅ **Less Cognitive Load**: No need to remember syntax
✅ **Startswith Filtering**: Typing filters suggestions intelligently
✅ **Full Query Completion**: Suggestions always show complete query
✅ **Error Prevention**: Can't select invalid operators for current state
✅ **Mobile-Friendly**: Listbox works with keyboard and touch

## Testing

Run tests with:
```bash
pnpm test src/lib/query-state-machine.test.ts
```

Tests cover:
- State detection for each stage
- Suggestion generation accuracy
- Fuzzy matching behavior
- Initial examples
