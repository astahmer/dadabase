# Query Builder Implementation

I've successfully added a frontend query builder that allows users to filter database queries with a visual interface. Here's what was implemented:

## Components Created

### 1. **Query Filter Types & Utilities** (`src/lib/query-filter.ts`)
- Defines filter operators: `equals`, `not_equals`, `contains`, `not_contains`, `starts_with`, `ends_with`, `greater_than`, `greater_than_or_equal`, `less_than`, `less_than_or_equal`, `is_null`, `is_not_null`, `in`, `not_in`
- `FilterCondition` type: represents a single filter condition with column, operator, and value
- `QueryFilter` type: manages multiple conditions with a logical operator (AND/OR)
- `conditionToWhereClause()`: converts a filter condition to SQL WHERE clause with parameters
- `filterToWhereClause()`: converts all conditions to a complete WHERE clause

### 2. **Query Builder Hook** (`src/hooks/use-query-builder.ts`)
- `useQueryBuilder()` hook provides:
  - State management for filter conditions
  - `addCondition()`: add a new filter
  - `updateCondition()`: modify an existing filter
  - `removeCondition()`: delete a filter
  - `setLogicalOperator()`: change between AND/OR logic
  - `clearConditions()`: reset all filters
  - `getWhereClause()`: get SQL WHERE clause and parameters
  - `hasActiveFilters`: check if filters are applied

### 3. **Query Filter Builder Component** (`src/components/query-filter-builder.tsx`)
- Visual UI component for building filters
- Displays when table data is loaded
- Features:
  - Column selector dropdown
  - Operator selector dropdown
  - Value input field (hidden for null operators)
  - Add/remove filter buttons
  - Logical operator toggle (AND/OR) when multiple filters exist
  - Loading state support

### 4. **Backend Updates**

#### Updated `queryTableData()` function
- Added `whereClause` parameter: the SQL WHERE clause (without WHERE keyword)
- Added `whereParams` parameter: parameter values for the WHERE clause
- Constructs queries dynamically based on filter conditions

#### Updated Server Function
- `queryTableDataQueryOptions` now accepts `whereClause` and `whereParams`
- Frontend can pass filters through these parameters

## How It Works

### Frontend Flow
1. User opens a database table in the connection page
2. Query filter builder appears above the data table
3. User clicks "Add Filter" to create a new condition
4. User selects:
   - **Column**: which column to filter
   - **Operator**: what condition to apply
   - **Value**: the value to filter by (optional for null operators)
5. Multiple filters can be combined with AND/OR logic
6. As filters change, the query automatically updates
7. Table refreshes showing only matching rows

### Backend Flow
1. Frontend builds WHERE clause from filter conditions
2. WHERE clause is passed to `queryTableDataQueryOptions()`
3. Server function receives the WHERE clause
4. `queryTableData()` function constructs SQL with the WHERE clause
5. Results are filtered server-side before being sent to client

## Usage Example

```typescript
// In your component using the query builder:
const queryBuilder = useQueryBuilder();

// User adds a filter for "id equals 5"
// Then adds another filter for "name contains 'test'"
// With AND logical operator

// Get the WHERE clause
const whereData = queryBuilder.getWhereClause();
// Returns: {
//   whereClause: `"id" = $1 AND "name" LIKE $2`,
//   params: { '$1': '5', '$2': '%test%' }
// }

// Pass to backend
const tableDataQuery = useQuery({
  ...queryTableDataQueryOptions({
    url: connection.url,
    schema: selectedSchema,
    table: selectedTable,
    limit: 50,
    offset: 0,
    whereClause: whereData?.whereClause,
    whereParams: whereData?.params,
  }),
});
```

## Supported Operators

- **Equals**: exact match
- **Not Equals**: doesn't match
- **Contains**: substring search (case-insensitive LIKE)
- **Does Not Contain**: excludes substring
- **Starts With**: string prefix
- **Ends With**: string suffix
- **Greater Than**: numeric/date comparison
- **Greater Than or Equal**: >=
- **Less Than**: <
- **Less Than or Equal**: <=
- **Is Null**: null values
- **Is Not Null**: non-null values
- **In**: value in a list
- **Not In**: value not in a list

## Integration in Connection Page

The query builder is integrated into `src/components/pages/connection.page.tsx`:

1. Initialized with `useQueryBuilder()` hook
2. Displayed via `<QueryFilterBuilder />` component
3. Available columns passed from table data
4. Filter conditions automatically applied to data queries
5. Filters work alongside sorting and pagination

## Key Features

✅ Visual filter builder UI
✅ Multiple filter conditions support
✅ AND/OR logical operators
✅ Dynamic column selection
✅ Server-side filtering (efficient)
✅ URL query parameters ready for future enhancement
✅ Type-safe TypeScript implementation
✅ SQL injection prevention (parameterized queries)
