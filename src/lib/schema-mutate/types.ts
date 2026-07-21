/** Column draft used by schema-mutate forms and SQL builders. */
export interface SchemaColumnDraft {
  name: string;
  dataType: string;
  nullable: boolean;
  primaryKey?: boolean;
  unique?: boolean;
  defaultValue?: string | null;
}

export type SchemaMutateDialect = "postgres" | "sqlite" | "libsql";

export function isSqliteLikeDialect(dialect: SchemaMutateDialect): boolean {
  return dialect === "sqlite" || dialect === "libsql";
}

/** Common type suggestions for the mutate form (free text still allowed). */
export const SCHEMA_MUTATE_TYPE_SUGGESTIONS: Record<"postgres" | "sqlite", readonly string[]> = {
  postgres: [
    "integer",
    "bigint",
    "text",
    "varchar(255)",
    "boolean",
    "uuid",
    "timestamptz",
    "timestamp",
    "date",
    "numeric",
    "jsonb",
    "double precision",
  ],
  sqlite: ["INTEGER", "TEXT", "REAL", "BLOB", "NUMERIC"],
};

export function defaultCreateTableColumns(dialect: SchemaMutateDialect): SchemaColumnDraft[] {
  const sqlite = isSqliteLikeDialect(dialect);
  return [
    {
      name: "id",
      dataType: sqlite ? "INTEGER" : "integer",
      nullable: false,
      primaryKey: true,
    },
  ];
}
