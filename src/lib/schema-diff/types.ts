/** Column shape needed for diffing; structurally compatible with introspection `ColumnInfo`. */
export interface SchemaDiffColumn {
  name: string;
  dataType: string;
  nullable: boolean;
  defaultValue?: string | null;
  primaryKey?: boolean;
}

export interface TableStructure {
  schema: string;
  table: string;
  columns: SchemaDiffColumn[];
}

export type SchemaDiffDialect = "postgres" | "sqlite";

export type SchemaDiffOp =
  | { kind: "add-table"; schema: string; table: string; columns: SchemaDiffColumn[] }
  | { kind: "drop-table"; schema: string; table: string }
  | { kind: "rename-table"; schema: string; fromTable: string; toTable: string }
  | { kind: "add-column"; schema: string; table: string; column: SchemaDiffColumn }
  | { kind: "drop-column"; schema: string; table: string; column: string }
  | {
      kind: "alter-column";
      schema: string;
      table: string;
      column: string;
      from: Pick<SchemaDiffColumn, "dataType" | "nullable" | "defaultValue">;
      to: Pick<SchemaDiffColumn, "dataType" | "nullable" | "defaultValue">;
    };
