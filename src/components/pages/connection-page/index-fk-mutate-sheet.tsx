import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { Button } from "#src/components/ui/button.tsx";
import { Checkbox, CheckboxControl } from "#src/components/ui/checkbox.tsx";
import { Input } from "#src/components/ui/input.tsx";
import { Label } from "#src/components/ui/label.tsx";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "#src/components/ui/sheet.tsx";
import { toaster } from "#src/components/ui/toaster.tsx";
import { DatabaseDialect } from "#src/db/dialect.ts";
import { guardReadOnlyMutation } from "#src/lib/connection-security.ts";
import { formatDbError } from "#src/lib/format-db-error.ts";
import { getErrorMessage } from "#src/lib/get-error-message.ts";
import {
  buildAddForeignKeySql,
  buildCreateIndexSql,
  buildDropForeignKeySql,
  buildDropIndexSql,
  isSqliteLikeDialect,
  type SchemaMutateDialect,
} from "#src/lib/schema-mutate/index.ts";
import { executeCustomSqlServerFn } from "#src/server/introspection/start-fns/execute-custom-sql.start.ts";

import { DestructiveQueryConfirmDialog } from "./destructive-query-confirm.dialog.tsx";
import { invalidateSchemaMetadataQueries } from "./invalidate-schema-metadata.ts";

export type IndexFkMutateMode = "create-index" | "drop-index" | "add-fk" | "drop-fk";

export interface IndexFkMutateSheetProps {
  open: boolean;
  mode: IndexFkMutateMode;
  onOpenChange: (open: boolean) => void;
  connectionUrl: string;
  dialect: DatabaseDialect;
  schema: string;
  table: string;
  /** Pre-filled when dropping an existing index. */
  indexName?: string;
  /** Pre-filled when dropping an existing FK. */
  constraintName?: string;
  columnSuggestions?: readonly string[];
}

function toMutateDialect(dialect: DatabaseDialect): SchemaMutateDialect {
  if (dialect === DatabaseDialect.Postgres) return "postgres";
  if (dialect === DatabaseDialect.LibSQL) return "libsql";
  return "sqlite";
}

export function IndexFkMutateSheet(props: IndexFkMutateSheetProps) {
  const {
    open,
    mode,
    onOpenChange,
    connectionUrl,
    dialect,
    schema,
    table,
    indexName: initialIndexName,
    constraintName: initialConstraint,
    columnSuggestions = [],
  } = props;
  const queryClient = useQueryClient();
  const mutateDialect = toMutateDialect(dialect);
  const sqliteLike = isSqliteLikeDialect(mutateDialect);

  const [indexName, setIndexName] = useState(initialIndexName ?? `${table}_idx`);
  const [columnsText, setColumnsText] = useState(columnSuggestions[0] ?? "");
  const [unique, setUnique] = useState(false);
  const [constraintName, setConstraintName] = useState(initialConstraint ?? `${table}_fk`);
  const [fkColumns, setFkColumns] = useState(columnSuggestions[0] ?? "");
  const [refSchema, setRefSchema] = useState(schema);
  const [refTable, setRefTable] = useState("");
  const [refColumns, setRefColumns] = useState("id");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const sql = useMemo(() => {
    try {
      if (mode === "create-index") {
        const columns = columnsText
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean);
        return buildCreateIndexSql({
          dialect: mutateDialect,
          schema,
          table,
          indexName,
          columns,
          unique,
        });
      }
      if (mode === "drop-index") {
        return buildDropIndexSql({ dialect: mutateDialect, schema, indexName });
      }
      if (mode === "add-fk") {
        if (sqliteLike) {
          return "-- SQLite cannot ADD CONSTRAINT; rebuild table instead (not supported here).";
        }
        return buildAddForeignKeySql({
          dialect: "postgres",
          schema,
          table,
          constraintName,
          columns: fkColumns
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean),
          referencedSchema: refSchema,
          referencedTable: refTable,
          referencedColumns: refColumns
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean),
        });
      }
      if (sqliteLike) {
        return "-- SQLite cannot DROP CONSTRAINT; rebuild table instead (not supported here).";
      }
      return buildDropForeignKeySql({
        dialect: "postgres",
        schema,
        table,
        constraintName,
      });
    } catch (e) {
      return `-- ${getErrorMessage(e)}`;
    }
  }, [
    columnsText,
    constraintName,
    fkColumns,
    indexName,
    mode,
    mutateDialect,
    refColumns,
    refSchema,
    refTable,
    schema,
    sqliteLike,
    table,
    unique,
  ]);

  const isDestructive = mode === "drop-index" || mode === "drop-fk";
  const canRun = Boolean(sql) && !sql.startsWith("--");

  const mutation = useMutation({
    mutationFn: async (statement: string) => {
      const blocked = guardReadOnlyMutation(connectionUrl);
      if (blocked) throw new Error(blocked);
      return executeCustomSqlServerFn({ data: { url: connectionUrl, sql: statement } });
    },
    onSuccess: async () => {
      toaster.create({ title: "Schema updated" });
      await invalidateSchemaMetadataQueries(queryClient, {
        url: connectionUrl,
        schema,
      });
      setConfirmOpen(false);
      onOpenChange(false);
    },
    onError: (e) => {
      toaster.create({ title: formatDbError(getErrorMessage(e)), type: "error" });
    },
  });

  const title =
    mode === "create-index"
      ? "Create index"
      : mode === "drop-index"
        ? "Drop index"
        : mode === "add-fk"
          ? "Add foreign key"
          : "Drop foreign key";

  const trySubmit = () => {
    if (!canRun) return;
    if (isDestructive) {
      setConfirmOpen(true);
      return;
    }
    mutation.mutate(sql);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(details) => onOpenChange(details.open)}>
        <SheetContent className="sm:max-w-md" data-testid="index-fk-mutate-sheet">
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>
              {schema}.{table}
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-3 overflow-auto px-1 py-4">
            {(mode === "create-index" || mode === "drop-index") && (
              <>
                <div className="space-y-2">
                  <Label>Index name</Label>
                  <Input
                    data-testid="index-fk-name"
                    value={indexName}
                    onChange={(e) => setIndexName(e.target.value)}
                  />
                </div>
                {mode === "create-index" && (
                  <>
                    <div className="space-y-2">
                      <Label>Columns (comma-separated)</Label>
                      <Input
                        data-testid="index-fk-columns"
                        value={columnsText}
                        onChange={(e) => setColumnsText(e.target.value)}
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox checked={unique} onCheckedChange={(v) => setUnique(Boolean(v))}>
                        <CheckboxControl />
                      </Checkbox>
                      Unique
                    </label>
                  </>
                )}
              </>
            )}

            {(mode === "add-fk" || mode === "drop-fk") && (
              <>
                <div className="space-y-2">
                  <Label>Constraint name</Label>
                  <Input
                    data-testid="index-fk-constraint"
                    value={constraintName}
                    onChange={(e) => setConstraintName(e.target.value)}
                  />
                </div>
                {mode === "add-fk" && (
                  <>
                    <div className="space-y-2">
                      <Label>Local columns</Label>
                      <Input value={fkColumns} onChange={(e) => setFkColumns(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Referenced schema</Label>
                      <Input value={refSchema} onChange={(e) => setRefSchema(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Referenced table</Label>
                      <Input
                        data-testid="index-fk-ref-table"
                        value={refTable}
                        onChange={(e) => setRefTable(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Referenced columns</Label>
                      <Input value={refColumns} onChange={(e) => setRefColumns(e.target.value)} />
                    </div>
                  </>
                )}
              </>
            )}

            <div className="space-y-2">
              <Label>SQL</Label>
              <pre
                data-testid="index-fk-sql-preview"
                className="bg-muted max-h-40 overflow-auto rounded-md p-3 font-mono text-xs whitespace-pre-wrap"
              >
                {sql}
              </pre>
            </div>
          </div>

          <SheetFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              data-testid="index-fk-run"
              disabled={!canRun || mutation.isPending}
              onClick={trySubmit}
            >
              {mutation.isPending ? "Running…" : "Run"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <DestructiveQueryConfirmDialog
        isOpen={confirmOpen}
        queryType={mode === "drop-index" ? "DROP INDEX" : "DROP CONSTRAINT"}
        isLoading={mutation.isPending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          mutation.mutate(sql);
        }}
      />
    </>
  );
}
