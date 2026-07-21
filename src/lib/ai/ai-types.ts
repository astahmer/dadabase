/** Shared column shape for AI helpers (subset of TableColumnMetadata). */
export interface AiColumnMeta {
  name: string;
  dataType: string;
  nullable: boolean;
  primaryKey: boolean;
  unique?: boolean;
  isEnum?: boolean;
  enumValues?: string[] | null;
  isForeignKey?: boolean;
  foreignKey?: {
    referencedSchema: string;
    referencedTable: string;
    referencedColumn: string;
  } | null;
}

/** Index shape for AI helpers (compatible with IndexInfo / GroupedIndex). */
export interface AiIndexMeta {
  index_name?: string;
  name?: string;
  column_name?: string;
  columns?: string[];
  is_unique?: boolean;
  is_primary?: boolean;
  isUnique?: boolean;
  isPrimary?: boolean;
}

export interface AiTableContext {
  schema: string;
  table: string;
  columns: readonly AiColumnMeta[];
  dialect?: "postgres" | "sqlite" | string;
}

/** Full-schema context for NL → SQL (prefer over single-table). */
export interface AiSchemaContext {
  dialect?: "postgres" | "sqlite" | string;
  schema: string;
  tables: readonly AiTableContext[];
  /** Optional hint: user currently has this table open in the UI */
  activeTable?: string;
}
