import type { TableColumnMetadata } from "#src/server/introspection/introspection.ts";

export interface JoinOnSnippetInput {
  /** Table already in the FROM clause (or its alias) */
  fromTable: string;
  /** Table being joined */
  joinTable: string;
  fromColumns: readonly TableColumnMetadata[];
  joinColumns: readonly TableColumnMetadata[];
  fromAlias?: string;
  joinAlias?: string;
}

export interface JoinOnSnippet {
  /** Full `JOIN "other" ON "from"."pk" = "other"."fk"` fragment (no leading JOIN type) */
  insertText: string;
  /** Human-readable detail for completion UI */
  detail: string;
  onClause: string;
}

const quoteIdent = (name: string) => `"${name.replace(/"/g, '""')}"`;

/**
 * Build a prefilled JOIN … ON … snippet from FK metadata between two tables.
 * Prefers FKs on the join table that reference the from table; falls back to the reverse.
 */
export const buildJoinOnSnippet = (input: JoinOnSnippetInput): JoinOnSnippet | null => {
  const fromRef = input.fromAlias || input.fromTable;
  const joinRef = input.joinAlias || input.joinTable;

  const outgoingOnJoin = input.joinColumns.find(
    (col) =>
      col.isForeignKey &&
      col.foreignKey?.referencedTable.toLowerCase() === input.fromTable.toLowerCase(),
  );
  if (outgoingOnJoin?.foreignKey) {
    const onClause = `${quoteIdent(fromRef)}.${quoteIdent(outgoingOnJoin.foreignKey.referencedColumn)} = ${quoteIdent(joinRef)}.${quoteIdent(outgoingOnJoin.name)}`;
    return {
      onClause,
      insertText: `${quoteIdent(input.joinTable)} ON ${onClause}`,
      detail: `FK ${joinRef}.${outgoingOnJoin.name} → ${fromRef}.${outgoingOnJoin.foreignKey.referencedColumn}`,
    };
  }

  const outgoingOnFrom = input.fromColumns.find(
    (col) =>
      col.isForeignKey &&
      col.foreignKey?.referencedTable.toLowerCase() === input.joinTable.toLowerCase(),
  );
  if (outgoingOnFrom?.foreignKey) {
    const onClause = `${quoteIdent(fromRef)}.${quoteIdent(outgoingOnFrom.name)} = ${quoteIdent(joinRef)}.${quoteIdent(outgoingOnFrom.foreignKey.referencedColumn)}`;
    return {
      onClause,
      insertText: `${quoteIdent(input.joinTable)} ON ${onClause}`,
      detail: `FK ${fromRef}.${outgoingOnFrom.name} → ${joinRef}.${outgoingOnFrom.foreignKey.referencedColumn}`,
    };
  }

  return null;
};

/** True when the cursor is completing a table name after a JOIN keyword (not FROM). */
export const isAfterJoinKeyword = (beforeCursor: string): boolean => {
  return /\b(?:INNER\s+|LEFT(?:\s+OUTER)?\s+|RIGHT(?:\s+OUTER)?\s+|FULL(?:\s+OUTER)?\s+|CROSS\s+)?JOIN\s+(?:"[^"]*"|\w*)$/i.test(
    beforeCursor,
  );
};
