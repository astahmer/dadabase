/**
 * SQL context parser - determines what type of suggestion should be shown
 * based on the SQL query and cursor position
 */

export type SqlContext =
  | { type: "table"; keyword: string }
  | { type: "column"; tableNames: string[] }
  | { type: "none" };

/**
 * Parse SQL to determine what context the cursor is in
 * Returns whether we should suggest tables or columns
 */
export function parseSqlContext(sql: string, cursorPosition: number): SqlContext {
  const textBeforeCursor = sql.substring(0, cursorPosition);

  // Keywords that typically precede table names - order matters (longest first)
  const tableKeywords = [
    "INNER JOIN",
    "LEFT JOIN",
    "RIGHT JOIN",
    "FULL JOIN",
    "CROSS JOIN",
    "JOIN",
    "FROM",
  ];

  // Keywords that typically precede column names
  const columnKeywords = ["SELECT", "WHERE", "ON", "ORDER BY", "GROUP BY"];

  // Check if we're after a table keyword
  for (const keyword of tableKeywords) {
    // Look for the keyword followed by whitespace and ending with whitespace or nothing
    // This prevents matching "SELECT name" when looking for column context
    const regex = new RegExp(`\\b${keyword}\\s+[\\w"]*\\s*$`, "i");
    if (regex.test(textBeforeCursor)) {
      // Make sure we're actually in the typing stage (after the keyword)
      const keywordMatch = textBeforeCursor.match(new RegExp(`\\b${keyword}\\s+`, "i"));
      if (keywordMatch) {
        // Check if there's meaningful content after the keyword
        const afterKeyword = textBeforeCursor.substring(
          keywordMatch.index! + keywordMatch[0].length,
        );
        // If there's no more actual keywords, we're typing a table name
        if (!/(WHERE|ON|ORDER|GROUP|LIMIT|HAVING|UNION)\b/i.test(afterKeyword)) {
          return { type: "table", keyword };
        }
      }
    }
  }

  // Check if we're after a column keyword
  for (const keyword of columnKeywords) {
    const regex = new RegExp(`\\b${keyword}\\s+`, "i");
    if (regex.test(textBeforeCursor)) {
      // Extract table names from the query up to cursor position
      const tableNames = extractAvailableTables(textBeforeCursor);
      return { type: "column", tableNames };
    }
  }

  return { type: "none" };
}

/**
 * Extract table names from SQL up to a certain point
 * Handles both qualified (schema.table) and unqualified table names
 */
function extractAvailableTables(sqlFragment: string): string[] {
  const tables: string[] = [];

  // Match fully qualified tables: schema.table (both quoted and unquoted)
  const qualifiedRegex = /(?:FROM|JOIN)\s+(?:"([^"]+)"|(\w+))\.(?:"([^"]+)"|(\w+))/gi;
  let match;

  while ((match = qualifiedRegex.exec(sqlFragment)) !== null) {
    const schema = match[1] || match[2];
    const tableName = match[3] || match[4];
    const fullName = `${schema}.${tableName}`;
    if (!tables.includes(fullName)) {
      tables.push(fullName);
    }
  }

  // Match unqualified tables: just table name (quoted or unquoted)
  // This will match any FROM/JOIN table that doesn't have a schema prefix
  const unqualifiedRegex = /(?:FROM|JOIN)\s+(?!"[^"]*"\.)(?:"([^"]+)"|(\w+))/gi;
  while ((match = unqualifiedRegex.exec(sqlFragment)) !== null) {
    const tableName = match[1] || match[2];
    if (
      tableName &&
      !tables.includes(tableName) &&
      !tables.some((t) => t.endsWith(`.${tableName}`))
    ) {
      tables.push(tableName);
    }
  }

  return tables;
}
