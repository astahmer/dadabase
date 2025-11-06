# Natural Language Search - Quick Reference

## Basic Queries

### Find by Value
```
name equals john
email is test@example.com
status = active
```

### Numbers & Comparisons
```
age > 25                          # greater than
age >= 25                         # greater than or equal
price < 100                       # less than
price <= 99.99                    # less than or equal
```

### Search Text
```
title contains javascript
description like react
email includes @gmail
```

### Range of Values
```
age between 20 and 30
price between 10 and 100
```

### Multiple Values
```
status in (active, pending, closed)
city in (new york, london, paris)
```

## Sorting & Limiting

### Sort Results
```
sort by name                      # A-Z (ascending)
sort by age asc                   # Explicit ascending
sort by price desc                # Z-A (descending)
order by created_at descending    # Alternative syntax
```

### Limit Results
```
top 10                            # Show 10 rows
limit 50                          # Show 50 rows
first 5 rows                      # Show 5 rows
```

## Combined Queries

### Filter + Sort
```
age > 25 sort by name desc
status = active sort by created_at
```

### Filter + Sort + Limit
```
age > 25 sort by name desc limit 10
status = active and city contains york sort by name top 20
```

### Multiple Filters
```
age > 25 and status = active
price > 10 and category = electronics
department contains sales and salary > 50000
```

## Tips & Tricks

### Column Name Matching
You don't need exact column names:
- `created_at` works as: "created at", "created_at", "createdat"
- `first_name` works as: "first name", "firstname", "first_name"
- Matching is case-insensitive

### Value Examples
```
age > 25                          # Numbers: no quotes needed
name equals john                  # Text: can be unquoted
email contains "gmail.com"        # Text with special chars: use quotes
status in (a, b, c)              # Lists: comma-separated in parentheses
```

### Common Mistakes
```
❌ sort name desc                 # Missing "by"
✓ sort by name desc

❌ age = 25 and = active          # Incomplete condition
✓ age = 25 and status = active

❌ price > $100                   # Special characters
✓ price > 100

❌ city in new york, london       # Missing parentheses
✓ city in (new york, london)
```

## Real-World Examples

### For CRM
```
status = qualified sort by last_contacted desc limit 20
company contains acme and revenue > 100000
```

### For E-Commerce
```
price between 50 and 200 and inventory > 0 sort by rating desc
category = electronics and brand in (apple, samsung)
```

### For Analytics
```
date between 2024-01-01 and 2024-12-31 sort by revenue desc limit 10
country in (us, uk, ca) and revenue > 10000
```

### For Project Management
```
status = in-progress and priority > 3 sort by due_date asc
assigned_to = john and status in (todo, in-progress)
```

## What You Can Do

✓ Filter data by any column
✓ Sort results ascending or descending
✓ Limit the number of results shown
✓ Combine multiple conditions
✓ Use natural language (not SQL)

## What You Can't Do (Yet)

✗ Date arithmetic (e.g., "last 7 days")
✗ Aggregate functions (COUNT, SUM, AVG)
✗ Nested conditions with parentheses
✗ Wildcards or regex patterns
✗ Joins to other tables

---

**Tips:**
- Start simple, build up complexity
- Use the hints/examples dropdown when in doubt
- Clear the search to go back to all rows
- Check the results display to verify your query was understood
