export type CustomSqlRunOptions = {
  /** Expand the SQL editor panel and show this SQL before running. */
  revealEditor?: boolean;
};

export type SqlRunHandler = (sql: string, options?: CustomSqlRunOptions) => void;

let sqlRunHandler: SqlRunHandler | null = null;

/** Register the active tab's custom-SQL runner (RowsTabContent / SQL editor). */
export const registerCustomSqlRunner = (handler: SqlRunHandler): (() => void) => {
  sqlRunHandler = handler;
  return () => {
    if (sqlRunHandler === handler) {
      sqlRunHandler = null;
    }
  };
};

/** Invoke the registered runner (AI drawer NL → run). */
export const runRegisteredCustomSql = (sql: string, options?: CustomSqlRunOptions): boolean => {
  if (!sqlRunHandler) return false;
  sqlRunHandler(sql, options);
  return true;
};
