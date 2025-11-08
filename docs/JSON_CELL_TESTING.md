# Testing the JSON Cell Integration

## How to Test

### 1. **With PostgreSQL Databases**

If you have a PostgreSQL table with JSON/JSONB columns:

1. Navigate to your connection in the application
2. Select a schema and table that contains `json` or `jsonb` columns
3. The table should now display:
   - **Before**: `[object Object]` text (hard to read)
   - **After**: Clickable buttons like `[Object]` or `[Array: N items]`

### 2. **Test Data Setup (Optional)**

Create a test table with JSON columns:

```sql
CREATE TABLE test_json_data (
  id SERIAL PRIMARY KEY,
  metadata JSONB,
  tags JSON[],
  config JSON
);

INSERT INTO test_json_data VALUES
  (1, '{"name": "John", "age": 30, "active": true}', '["tag1", "tag2", "tag3"]', '{"key": "value"}'),
  (2, '{"name": "Jane", "city": "NYC", "roles": ["admin", "user"]}', '["production"]', '{"debug": true}');
```

### 3. **Test the Features**

#### Clicking a JSON cell:
1. Click on any `[Object]` or `[Array]` button in a JSON column
2. A dialog should open with:
   - ✅ Syntax-highlighted JSON
   - ✅ Collapsible nodes (objects and arrays)
   - ✅ Copy to clipboard button
   - ✅ Dark mode support

#### Expanding/Collapsing:
1. Click the chevron icon next to objects/arrays to expand/collapse
2. Nested structures should toggle smoothly

#### Copying:
1. Click the "Copy" button in the dialog
2. Button text changes to "Copied!" temporarily
3. JSON data is copied to clipboard in pretty-printed format

### 4. **Edge Cases to Test**

- ✅ Empty JSON objects: `{}`
- ✅ Empty JSON arrays: `[]`
- ✅ Deeply nested structures
- ✅ Large arrays with many items
- ✅ Mixed types in arrays
- ✅ Null values
- ✅ Boolean and numeric values

### 5. **Column Type Detection**

The system should automatically detect and format these column types:

| Column Type | Detected | Rendered with JsonCell |
|-------------|----------|------------------------|
| `json` | ✅ Yes | ✅ Yes |
| `jsonb` | ✅ Yes | ✅ Yes |
| `json[]` | ✅ Yes | ✅ Yes |
| `jsonb[]` | ✅ Yes | ✅ Yes |
| `JSON` (uppercase) | ✅ Yes | ✅ Yes |
| `other` | ❌ No | ❌ No |

## Troubleshooting

### JSON cell not showing up?
- Check that the column dataType includes "json" (case-insensitive)
- Verify the column is visible in the table (check column visibility settings)
- Check browser console for any errors

### Dialog won't open?
- Ensure the JsonCell component is properly imported
- Check that the Dialog component from shadcn is working
- Try refreshing the page

### Copy button not working?
- Ensure the browser allows clipboard access
- Check that you're on HTTPS or localhost
- Try with a different browser

## Performance Notes

- Memoization prevents unnecessary re-renders
- Large JSON objects are collapsed by default
- Max depth is set to 10 to prevent infinite expansion
- Consider using maxDepth prop if working with extremely deep structures

## Next Steps / Enhancements

Possible future improvements:
- [ ] Add search/filter within JSON viewer
- [ ] Add JSON diff viewer for comparing two JSON objects
- [ ] Add JSON path navigation
- [ ] Add export as file options (JSON, CSV)
- [ ] Add syntax validation/linting
