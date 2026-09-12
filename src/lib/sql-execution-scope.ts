import {
  isDestructiveQuery,
  isReadOnlyQuery,
} from "#src/server/introspection/detect-destructive-sql.ts";

import { splitSqlStatements, type SqlStatement } from "./sql-statements.ts";

export type SqlExecutionScopeKind = "selection" | "statement" | "script";

export interface SqlExecutionScope {
  kind: SqlExecutionScopeKind;
  sql: string;
  statementIndex: number | undefined;
  statementCount: number;
  totalStatementCount: number;
  lineCount: number;
  hasWrites: boolean;
  hasDestructiveStatements: boolean;
}

const isWriteStatement = (sql: string) => {
  const normalized = sql.trim().toLowerCase();
  return !isReadOnlyQuery(sql) && !/^(explain|pragma|show|describe)\b/.test(normalized);
};

const statementLineCount = (statement: SqlStatement | undefined) => {
  if (!statement) return 0;
  return Math.max(1, statement.endLine - statement.startLine + 1);
};

const findMatchingStatement = (statements: readonly SqlStatement[], sql: string) => {
  const normalized = sql.trim().replace(/;+$/, "");
  return statements.find((statement) => statement.sql.trim().replace(/;+$/, "") === normalized);
};

export const getSqlExecutionScope = (
  editorValue: string,
  statementSql?: string,
): SqlExecutionScope => {
  const statements = splitSqlStatements(editorValue);
  const selectedSql = statementSql?.trim();
  const matchingStatement = selectedSql
    ? findMatchingStatement(statements, selectedSql)
    : undefined;
  const sql = selectedSql || editorValue.trim();
  const selectedStatements = matchingStatement ? [matchingStatement] : statements;
  const kind: SqlExecutionScopeKind = selectedSql
    ? matchingStatement
      ? "statement"
      : "selection"
    : "script";

  return {
    kind,
    sql,
    statementIndex: matchingStatement ? statements.indexOf(matchingStatement) : undefined,
    statementCount: selectedStatements.length,
    totalStatementCount: statements.length,
    lineCount: matchingStatement
      ? statementLineCount(matchingStatement)
      : Math.max(1, sql.split("\n").length),
    hasWrites: selectedStatements.some((statement) => isWriteStatement(statement.sql)),
    hasDestructiveStatements: selectedStatements.some((statement) =>
      isDestructiveQuery(statement.sql),
    ),
  };
};

export const formatSqlExecutionScope = (scope: SqlExecutionScope): string => {
  if (scope.kind === "selection") {
    return `Run selection · ${scope.lineCount} line${scope.lineCount === 1 ? "" : "s"}`;
  }
  if (scope.kind === "statement" && scope.statementIndex !== undefined) {
    return `Run statement ${scope.statementIndex + 1} of ${scope.totalStatementCount}`;
  }
  if (scope.statementCount > 1) {
    return `Run all ${scope.statementCount} statements`;
  }
  return "Run query";
};

export const summarizeSqlStatement = (sql: string, maxLength = 32): string => {
  const oneLine = sql.replace(/\s+/g, " ").trim();
  if (oneLine.length <= maxLength) return oneLine;
  return `${oneLine.slice(0, Math.max(0, maxLength - 1))}…`;
};
