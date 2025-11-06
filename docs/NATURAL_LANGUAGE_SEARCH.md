# Natural Language Search

A rule-based natural language to SQL filter parser that works completely offline without requiring any LLM or external services.

## Features

- **No dependencies on LLMs** - Pure rule-based parsing using regex patterns
- **Works offline** - All processing happens locally in the browser/server
- **Fast** - Regex matching is lightweight and performant
- **Flexible** - Easily extensible to support new query patterns
- **TypeScript** - Full type safety

## Supported Query Patterns

### Simple Filters

```
age equals 25                    # Exact match
name is john
status = active

email contains gmail              # Partial match
title like JavaScript
```

### Comparison Operators

```
age > 25                          # Greater than
age greater than 25
age >= 25                         # Greater than or equal
age gte 25

price < 100                       # Less than
price less than 100
price <= 100                      # Less than or equal
```

### Between Ranges

```
age between 20 and 30
price between 10.50 and 99.99
```

### In List

```
status in (active, pending, closed)
city in (new york, london, paris)
```

### Sorting

```
sort by name                      # Ascending (default)
sort by name asc
sort by name ascending

sort by age desc                  # Descending
sort by age descending
order by price desc
```

### Limiting Results

```
top 10                            # Return top 10 results
limit 50                          # Limit to 50 rows
first 5 rows                      # Get first 5 rows
```

### Complex Queries

Combine multiple conditions:

```
age > 25 and status equals active sort by name desc limit 10
city contains york and price between 10 and 100
email contains gmail limit 20
```

## Supported Operators

| Operator | Examples | Maps To |
|----------|----------|---------|
| `eq` | `equals`, `is`, `=` | equals |
| `gt` | `>`, `greater than` | greater_than |
| `lt` | `<`, `less than` | less_than |
| `gte` | `>=`, `greater than or equal` | greater_than_or_equal |
| `lte` | `<=`, `less than or equal` | less_than_or_equal |
| `contains` | `contains`, `like`, `includes` | contains |
| `in` | `in`, `one of` | in |
| `not_eq` | `not equal`, `!=`, `<>` | not_equals |
| `not_contains` | `does not contain`, `not like` | not_contains |

## Usage

### Basic Usage

```typescript
import { parseNaturalLanguageQuery } from '#src/lib/natural-language-parser';

const columns = ['id', 'name', 'email', 'age', 'status'];
const query = 'age > 25 and status = active';

const result = parseNaturalLanguageQuery(query, columns);

if (result.success) {
  console.log('Filters:', result.filters);
  console.log('Sort:', result.orderBy);
  console.log('Limit:', result.limit);
} else {
  console.log('Error:', result.message);
}
```

### In React Components

```typescript
import { NaturalLanguageSearch } from '#src/components/natural-language-search';

export function MyTable() {
  const columns = ['id', 'name', 'email', 'age'];

  const handleApplyFilters = (filters, orderBy, limit) => {
    // Apply filters to your query
    console.log('Filters:', filters);
  };

  return (
    <NaturalLanguageSearch
      availableColumns={columns}
      onApplyFilters={handleApplyFilters}
      placeholder="Try: 'age > 25', 'sort by name desc'"
    />
  );
}
```

### Using the Hook

```typescript
import { useNaturalLanguageSearch } from '#src/hooks/use-natural-language-search';

export function SearchComponent() {
  const { parse } = useNaturalLanguageSearch();

  const handleSearch = (input: string) => {
    const result = parse(input, ['name', 'email', 'age']);
    // Use result.filters, result.orderBy, result.limit
  };

  return <input onChange={(e) => handleSearch(e.target.value)} />;
}
```

## Returned Structure

```typescript
interface ParsedNLQuery {
  success: boolean;
  filters?: FilterCondition[];        // Parsed filter conditions
  orderBy?: {                         // Sort configuration
    field: string;
    direction: 'asc' | 'desc';
  };
  limit?: number;                     // Row limit
  message?: string;                   // Error message if !success
  rawInput?: string;                  // Original input for debugging
}

interface FilterCondition {
  field: string;                      // Column name
  operator: FilterOperator;           // Operator type
  value: string | number | (string | number)[]; // Value(s)
}

type FilterOperator = 'eq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'in' | 'not_eq' | 'not_contains';
```

## Column Matching

The parser uses fuzzy matching to find columns, so users don't need exact column names:

```typescript
// These all match the 'created_at' column:
'created at > 2024-01-01'
'created_at > 2024-01-01'
'createdat > 2024-01-01'

// These all match the 'status' column:
'status = active'
'stat = active'
'statut = active'  // Close matches work too
```

## Limitations

- **Multi-word operators**: Currently only single-word operators are supported reliably
- **Date handling**: Dates are treated as strings; no automatic date parsing
- **Complex nested conditions**: OR/AND combinations are basic
- **Unquoted strings with spaces**: Spaces in values may cause issues (use quotes when needed)
- **Special characters**: Be careful with special regex characters in values

## Architecture

### Files

- `src/lib/natural-language-parser.ts` - Core parsing logic
- `src/hooks/use-natural-language-search.ts` - React hook for easy integration
- `src/components/natural-language-search.tsx` - Pre-built UI component
- `src/lib/natural-language-parser.test.ts` - Comprehensive test suite

### How It Works

1. **Input normalization** - Convert to lowercase, trim whitespace
2. **Column matching** - Use fuzzy matching to find actual column names
3. **Pattern matching** - Apply regex patterns to extract:
   - Basic conditions (field operator value)
   - Between ranges
   - IN lists
   - Sort clauses
   - Limit clauses
4. **Return structured data** - Convert to QueryFilterType for use in queries

## Testing

Run the test suite:

```bash
npm run test:run -- natural-language-parser.test.ts
```

Tests cover:
- Simple equality filters
- Comparison operators (>, <, >=, <=)
- Contains/Like operators
- Between ranges
- IN lists
- Sort clauses (asc/desc)
- Limit clauses
- Complex multi-clause queries
- Error handling

## Examples

### E-Commerce Product Search

```
"price between 10 and 100 and status equals in-stock sort by rating desc limit 20"
```

### CRM Lead Management

```
"status = qualified and company contains acme and created_at > 2024-01-01 sort by name"
```

### Blog Post Management

```
"author contains john and status = published sort by created_at desc top 10"
```

### Database Exploration (dadabase)

```
"age > 25 and city contains york sort by created_at desc limit 50"
```

## Future Enhancements

Potential improvements:
- Date parsing with natural language (e.g., "last 7 days")
- Time-based filters (e.g., "created today")
- Regex pattern matching in values
- More complex boolean logic (nested AND/OR)
- Aggregate functions (COUNT, SUM, AVG)
- Custom operator definitions per table

## Performance

- **Parsing**: < 1ms for typical queries
- **Column matching**: O(n) where n = number of columns
- **Memory**: Minimal overhead, no external dependencies
- **Browser**: Works in all modern browsers

## Privacy

All processing happens locally - no data is sent to external services.
