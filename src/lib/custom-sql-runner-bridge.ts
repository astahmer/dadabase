type SqlRunHandler = (sql: string) => void;

let sqlRunHandler: SqlRunHandler | null = null;

/** Register the active tab's custom-SQL runner (RowsTabContent). */
export const registerCustomSqlRunner = (handler: SqlRunHandler): (() => void) => {
  sqlRunHandler = handler;
  return () => {
    if (sqlRunHandler === handler) {
      sqlRunHandler = null;
    }
  };
};

/** Invoke the registered runner (AI drawer NL → run). */
export const runRegisteredCustomSql = (sql: string): boolean => {
  if (!sqlRunHandler) return false;
  sqlRunHandler(sql);
  return true;
};
