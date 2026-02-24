Based on my analysis of the test files, here's a comprehensive list of **SQL parsing cases NOT currently handled**:

## Currently NOT Parsed

### 1. **Other JOIN Types**
- **INNER JOIN** (lines 2894, 3090, 3150, 5409)
  - Example: `SELECT * FROM users INNER JOIN posts ON posts.user_id = users.id`
  - Status: Suggested but not parsed

- **RIGHT JOIN** (lines 2959, 5423)
  - Example: `SELECT * FROM posts RIGHT JOIN users ON posts.user_id = users.id`
  - Status: Suggested but not parsed

- **FULL OUTER JOIN** (lines 2992, 5437)
  - Example: `SELECT * FROM comments FULL OUTER JOIN users ON comments.user_id = users.id`
  - Status: Suggested but not parsed

- **CROSS JOIN** (lines 993, 1055, 1116, 1176, 1659, 1821, 2231, 3075, 3919)
  - Example: `SELECT * FROM users CROSS JOIN posts`
  - Status: Suggested but not parsed

- **Multiple JOINs** (line 3293)
  - Example: `SELECT * FROM users u JOIN posts p ON u.id = p.user_id JOIN comments c ON p.id = c.post_id WHERE u.`
  - Status: Partially handled (LEFT JOINs), but chaining not fully tested

### 2. **GROUP BY Clause**
- **Basic GROUP BY** (lines 4367, 4413)
  - Example: `SELECT users.id, COUNT(*) FROM users GROUP BY users.id`
  - Status: Not parsed

- **Multiple column GROUP BY** (line 4413)
  - Example: `SELECT users.id, users.name, COUNT(*) FROM users GROUP BY users.id, users.name`
  - Status: Not parsed

### 3. **HAVING Clause**
- **HAVING with aggregate conditions** (lines 4212, 4256, 4904, 4976, 4993)
  - Example: `SELECT users.id, COUNT(*) FROM users GROUP BY users.id HAVING COUNT(*) > 5`
  - Example: `SELECT users.id, COUNT(*) FROM users GROUP BY users.id HAVING COUNT(*) > 5 AND SUM(users.id) < 100`
  - Status: Not parsed

### 4. **Aggregate Functions**
- **COUNT()** (lines 2546, 2548, 4212, 4256)
  - Example: `SELECT COUNT(users.id) FROM users`
  - Status: Autocomplete suggested but values not extracted/parsed

- **SUM()** (line 2617)
  - Example: `SELECT SUM(users.salary) FROM users`
  - Status: Autocomplete suggested but not parsed

- **AVG()** (line 2685)
  - Example: `SELECT AVG(posts.views) FROM posts`
  - Status: Autocomplete suggested but not parsed

- **MAX()** (line 2753)
  - Example: `SELECT MAX(comments.rating) FROM comments`
  - Status: Autocomplete suggested but not parsed

- **MIN()** (line 2822)
  - Example: `SELECT MIN(users.created_at), MAX(users.updated_at) FROM users`
  - Status: Autocomplete suggested but not parsed

### 5. **DISTINCT Keyword**
- **SELECT DISTINCT** (line 4297)
  - Example: `SELECT DISTINCT users.email FROM users`
  - Status: Autocomplete suggested but not parsed/extracted

### 6. **Subqueries**
- **EXISTS subquery** (lines 3711, 3751, 3845, 5340)
  - Example: `SELECT * FROM users WHERE EXISTS (SELECT * FROM posts WHERE posts.user_id = users.id)`
  - Status: Not parsed

- **IN with subquery** (lines 5297, 5354, 5370)
  - Example: `SELECT * FROM users WHERE id IN (SELECT id FROM posts WHERE user_id IN (...))`
  - Status: Not fully parsed (IN operator parsed but not subquery detection)

### 7. **UNION Operations**
- **UNION** (lines 4668, 4669, 4718, 4719, 4755, 4756, 4803, 4808, 4955, 4960)
  - Example: Multiple SELECT queries combined with UNION
  - Status: Autocomplete suggested but not parsed

- **UNION ALL** (lines 4723, 4724, 4809, 4961)
  - Example: Multiple SELECT queries combined with UNION ALL
  - Status: Autocomplete suggested but not parsed

### 8. **Advanced WHERE Conditions**
- **NOT operator** (line 3579)
  - Example: `SELECT * FROM users WHERE NOT users.active`
  - Status: Not parsed

- **Parenthesized conditions** (line 3664)
  - Example: `SELECT * FROM users WHERE (users.id = 1 OR users.email = 'test@test.com') AND users.`
  - Status: Not fully parsed (nesting/grouping not handled)

### 9. **FROM Clause Aliases**
- **Table aliases without AS** (lines 3934, 3994, 5009)
  - Example: `SELECT * FROM users u, posts p WHERE u.id = p.user_id`
  - Status: Partially handled in JOINs but implicit FROM aliases not fully supported

### 10. **ORDER BY Extensions**
- **NULLS FIRST/NULLS LAST** (lines 5264, 5280)
  - Example: `SELECT * FROM users ORDER BY users.id DESC NULLS LAST`
  - Status: Not parsed

### 11. **Complex SELECT Clauses**
- **Hidden columns in SELECT** (not actively tested for complex patterns)
  - Currently extracts column list but doesn't handle:
    - Expressions: `SELECT users.id * 2 FROM users`
    - Aliases: `SELECT users.id AS user_identifier FROM users`
    - Functions in SELECT: `SELECT CONCAT(users.first_name, ' ', users.last_name) FROM users`

---

## Summary by Complexity

**High Priority (Foundation for many features):**
1. GROUP BY extraction
2. HAVING clause parsing
3. Other JOIN types (INNER, RIGHT, FULL OUTER)
4. DISTINCT keyword
5. Subqueries (EXISTS, IN subqueries)

**Medium Priority:**
1. Aggregate function detection/parsing
2. UNION operations
3. Multiple JOIN chaining
4. NOT operator
5. Parenthesized conditions

**Lower Priority (Polish):**
1. NULLS FIRST/NULLS LAST
2. FROM table aliases (implicit syntax)
3. Complex SELECT expressions

All of these patterns are already present in the completion provider test suite, suggesting they're important use cases the UI should support.
