import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

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
import { guardReadOnlyMutation } from "#src/lib/connection-security.ts";
import { DatabaseDialect } from "#src/db/dialect.ts";
import { formatDbError } from "#src/lib/format-db-error.ts";
import { getErrorMessage } from "#src/lib/get-error-message.ts";
import {
  buildAddColumnSql,
  buildAlterColumnSql,
  buildCreateTableSql,
  buildSqliteRebuildAlterSql,
  buildSqliteRebuildAlterSteps,
  defaultCreateTableColumns,
  isSqliteLikeDialect,
  SCHEMA_MUTATE_TYPE_SUGGESTIONS,
  type SchemaColumnDraft,
  type SchemaMutateDialect,
  UnsupportedSchemaMutateError,
} from "#src/lib/schema-mutate/index.ts";
import { executeCustomSqlServerFn } from "#src/server/introspection/start-fns/execute-custom-sql.start.ts";
import { executeSqliteTableRebuildServerFn } from "#src/server/introspection/start-fns/execute-sqlite-table-rebuild.start.ts";

import { DestructiveQueryConfirmDialog } from "./destructive-query-confirm.dialog.tsx";
import { invalidateSchemaMetadataQueries } from "./invalidate-schema-metadata.ts";

export type SchemaMutateMode = "create-table" | "add-column" | "alter-column";

export interface SchemaMutateSheetState {
  open: boolean;
  mode: SchemaMutateMode;
  /** Pre-filled column when altering */
  column?: SchemaColumnDraft | null;
}

export interface SchemaMutateSheetProps {
  open: boolean;
  mode: SchemaMutateMode;
  column?: SchemaColumnDraft | null;
  connectionUrl: string;
  dialect: DatabaseDialect;
  schema: string;
  table?: string;
  /** Full current column list for the table being altered — required for SQLite rebuild-based ALTER. */
  allColumns?: readonly SchemaColumnDraft[];
  onOpenChange: (open: boolean) => void;
  onSuccess?: (details: { mode: SchemaMutateMode; table: string; sql: string }) => void;
}

function toMutateDialect(dialect: DatabaseDialect): SchemaMutateDialect {
  if (dialect === DatabaseDialect.Postgres) return "postgres";
  if (dialect === DatabaseDialect.LibSQL) return "libsql";
  return "sqlite";
}

function emptyColumn(dialect: SchemaMutateDialect): SchemaColumnDraft {
  return {
    name: "",
    dataType: isSqliteLikeDialect(dialect) ? "TEXT" : "text",
    nullable: true,
  };
}

export function SchemaMutateSheet(props: SchemaMutateSheetProps) {
  const {
    open,
    mode,
    column,
    connectionUrl,
    dialect,
    schema,
    table: tableProp,
    allColumns,
    onOpenChange,
    onSuccess,
  } = props;

  const mutateDialect = toMutateDialect(dialect);
  const queryClient = useQueryClient();
  const typeSuggestions = isSqliteLikeDialect(mutateDialect)
    ? SCHEMA_MUTATE_TYPE_SUGGESTIONS.sqlite
    : SCHEMA_MUTATE_TYPE_SUGGESTIONS.postgres;

  const [tableName, setTableName] = useState(tableProp ?? "");
  const [columns, setColumns] = useState<SchemaColumnDraft[]>(() =>
    defaultCreateTableColumns(mutateDialect),
  );
  const [singleColumn, setSingleColumn] = useState<SchemaColumnDraft>(() =>
    emptyColumn(mutateDialect),
  );
  const [previousColumn, setPreviousColumn] = useState<SchemaColumnDraft | null>(null);
  const [showSql, setShowSql] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSubmitError(null);
    setShowSql(true);
    setTableName(tableProp ?? "");
    if (mode === "create-table") {
      setColumns(defaultCreateTableColumns(mutateDialect));
    } else if (mode === "add-column") {
      setSingleColumn(emptyColumn(mutateDialect));
    } else if (mode === "alter-column" && column) {
      setSingleColumn({ ...column });
      setPreviousColumn({ ...column });
    }
  }, [open, mode, column, tableProp, mutateDialect]);

  const sqlPreview = useMemo(() => {
    try {
      if (mode === "create-table") {
        return buildCreateTableSql({
          dialect: mutateDialect,
          schema,
          table: tableName,
          columns,
        });
      }
      if (mode === "add-column") {
        return buildAddColumnSql({
          dialect: mutateDialect,
          schema,
          table: tableName || tableProp || "",
          column: singleColumn,
        });
      }
      if (mode === "alter-column" && previousColumn) {
        if (isSqliteLikeDialect(mutateDialect)) {
          if (!allColumns || allColumns.length === 0) {
            return "-- Missing full column list; cannot build SQLite rebuild ALTER";
          }
          return buildSqliteRebuildAlterSql({
            schema,
            table: tableName || tableProp || "",
            columns: allColumns,
            alter: {
              columnName: previousColumn.name,
              dataType: singleColumn.dataType,
              nullable: singleColumn.nullable,
              defaultValue: singleColumn.defaultValue ?? null,
            },
          });
        }
        return buildAlterColumnSql({
          dialect: mutateDialect,
          schema,
          table: tableName || tableProp || "",
          columnName: previousColumn.name,
          column: singleColumn,
          previous: previousColumn,
        });
      }
      return "";
    } catch (err) {
      if (err instanceof UnsupportedSchemaMutateError) return `-- ${err.message}`;
      return `-- ${getErrorMessage(err)}`;
    }
  }, [
    mode,
    mutateDialect,
    schema,
    tableName,
    tableProp,
    columns,
    singleColumn,
    previousColumn,
    allColumns,
  ]);

  const title =
    mode === "create-table"
      ? "Create table"
      : mode === "add-column"
        ? "Add column"
        : "Alter column";

  const needsConfirm = mode === "alter-column";

  const mutation = useMutation({
    mutationFn: async (payload: { sql: string; sqliteRebuildStatements?: string[] }) => {
      const readOnlyError = guardReadOnlyMutation(connectionUrl);
      if (readOnlyError) throw new Error(readOnlyError);
      if (payload.sqliteRebuildStatements) {
        return executeSqliteTableRebuildServerFn({
          data: { url: connectionUrl, statements: payload.sqliteRebuildStatements },
        });
      }
      return executeCustomSqlServerFn({
        data: { url: connectionUrl, sql: payload.sql },
      });
    },
    meta: { noInvalidate: true },
    onSuccess: (_data, payload) => {
      const resolvedTable = (tableName || tableProp || "").trim();
      invalidateSchemaMetadataQueries(queryClient, {
        url: connectionUrl,
        schema,
      });
      toaster.create({ title: `${title} succeeded` });
      onSuccess?.({ mode, table: resolvedTable, sql: payload.sql });
      onOpenChange(false);
    },
    onError: (error) => {
      setSubmitError(formatDbError(error) || getErrorMessage(error));
    },
  });

  const trySubmit = (opts?: { confirmed?: boolean }) => {
    setSubmitError(null);
    let sql: string;
    let sqliteRebuildStatements: string[] | undefined;
    try {
      if (mode === "create-table") {
        sql = buildCreateTableSql({
          dialect: mutateDialect,
          schema,
          table: tableName,
          columns,
        });
      } else if (mode === "add-column") {
        sql = buildAddColumnSql({
          dialect: mutateDialect,
          schema,
          table: tableName || tableProp || "",
          column: singleColumn,
        });
      } else {
        if (!previousColumn) throw new Error("No column selected");
        if (isSqliteLikeDialect(mutateDialect)) {
          if (!allColumns || allColumns.length === 0) {
            throw new Error("Missing full column list; cannot build SQLite rebuild ALTER");
          }
          const shadowSuffix = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
          const rebuildInput = {
            schema,
            table: tableName || tableProp || "",
            columns: allColumns,
            alter: {
              columnName: previousColumn.name,
              dataType: singleColumn.dataType,
              nullable: singleColumn.nullable,
              defaultValue: singleColumn.defaultValue ?? null,
            },
            shadowSuffix,
          };
          sql = buildSqliteRebuildAlterSql(rebuildInput);
          sqliteRebuildStatements = buildSqliteRebuildAlterSteps(rebuildInput);
        } else {
          sql = buildAlterColumnSql({
            dialect: mutateDialect,
            schema,
            table: tableName || tableProp || "",
            columnName: previousColumn.name,
            column: singleColumn,
            previous: previousColumn,
          });
        }
      }
    } catch (err) {
      setSubmitError(getErrorMessage(err));
      return;
    }

    if (needsConfirm && !opts?.confirmed) {
      setConfirmOpen(true);
      return;
    }
    setConfirmOpen(false);
    mutation.mutate({ sql, sqliteRebuildStatements });
  };

  const updateColumnAt = (index: number, patch: Partial<SchemaColumnDraft>) => {
    setColumns((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  };

  const alterDisabled =
    mode === "alter-column" &&
    isSqliteLikeDialect(mutateDialect) &&
    (!allColumns || allColumns.length === 0);

  return (
    <>
      <Sheet open={open} onOpenChange={(d) => onOpenChange(d.open)}>
        <SheetContent
          side="right"
          size="md"
          className="flex flex-col"
          data-testid="schema-mutate-sheet"
        >
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription className="text-xs">
              Generates DDL for {isSqliteLikeDialect(mutateDialect) ? "SQLite" : "Postgres"}.
              Preview SQL before running.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-4 overflow-auto px-1 py-2">
            {(mode === "create-table" || !tableProp) && (
              <div className="space-y-1.5">
                <Label htmlFor="schema-mutate-table">Table name</Label>
                <Input
                  id="schema-mutate-table"
                  data-testid="schema-mutate-table-name"
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                  placeholder="widgets"
                  disabled={mode !== "create-table" && !!tableProp}
                />
              </div>
            )}

            {mode === "create-table" ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Columns</Label>
                  <Button
                    type="button"
                    size="xs"
                    variant="outline"
                    className="gap-1"
                    onClick={() => setColumns((prev) => [...prev, emptyColumn(mutateDialect)])}
                    data-testid="schema-mutate-add-column-row"
                  >
                    <Plus className="h-3 w-3" />
                    Column
                  </Button>
                </div>
                {columns.map((col, index) => (
                  <ColumnDraftFields
                    key={index}
                    column={col}
                    typeSuggestions={typeSuggestions}
                    showPrimaryKey
                    onChange={(patch) => updateColumnAt(index, patch)}
                    onRemove={
                      columns.length > 1
                        ? () => setColumns((prev) => prev.filter((_, i) => i !== index))
                        : undefined
                    }
                    testIdPrefix={`schema-mutate-col-${index}`}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {mode === "alter-column" && isSqliteLikeDialect(mutateDialect) && (
                  <p
                    className="text-muted-foreground text-xs"
                    data-testid="schema-mutate-sqlite-alter-hint"
                  >
                    {alterDisabled
                      ? "SQLite cannot change column type/null/default without rebuilding the table, and the current column list is unavailable to build the rebuild."
                      : "SQLite requires a full table rebuild to alter a column (copies rows into a shadow table)."}
                  </p>
                )}
                <ColumnDraftFields
                  column={singleColumn}
                  typeSuggestions={typeSuggestions}
                  showPrimaryKey={false}
                  nameReadOnly={mode === "alter-column"}
                  disabled={alterDisabled}
                  onChange={(patch) => setSingleColumn((prev) => ({ ...prev, ...patch }))}
                  testIdPrefix="schema-mutate-col"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => setShowSql((v) => !v)}
                data-testid="schema-mutate-toggle-sql"
              >
                {showSql ? "Hide SQL" : "Show SQL"}
              </Button>
              {showSql && (
                <pre
                  className="bg-muted max-h-48 overflow-auto rounded-md p-3 font-mono text-xs whitespace-pre-wrap"
                  data-testid="schema-mutate-sql-preview"
                >
                  {sqlPreview || "-- fill the form to preview SQL"}
                </pre>
              )}
            </div>

            {submitError && (
              <p className="text-destructive text-xs" data-testid="schema-mutate-error">
                {submitError}
              </p>
            )}
          </div>

          <SheetFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={trySubmit}
              disabled={mutation.isPending || alterDisabled}
              data-testid="schema-mutate-run"
            >
              {mutation.isPending ? "Running…" : "Run"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <DestructiveQueryConfirmDialog
        isOpen={confirmOpen}
        queryType="ALTER table structure"
        isLoading={mutation.isPending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          trySubmit({ confirmed: true });
        }}
      />
    </>
  );
}

function ColumnDraftFields(props: {
  column: SchemaColumnDraft;
  typeSuggestions: readonly string[];
  showPrimaryKey: boolean;
  nameReadOnly?: boolean;
  disabled?: boolean;
  onChange: (patch: Partial<SchemaColumnDraft>) => void;
  onRemove?: () => void;
  testIdPrefix: string;
}) {
  const {
    column,
    typeSuggestions,
    showPrimaryKey,
    nameReadOnly,
    disabled,
    onChange,
    onRemove,
    testIdPrefix,
  } = props;

  return (
    <div className="border-border space-y-2 rounded-md border p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <Label className="text-xs">Name</Label>
          <Input
            value={column.name}
            disabled={disabled || nameReadOnly}
            onChange={(e) => onChange({ name: e.target.value })}
            data-testid={`${testIdPrefix}-name`}
            className="h-8"
          />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <Label className="text-xs">Type</Label>
          <input
            list={`${testIdPrefix}-types`}
            value={column.dataType}
            disabled={disabled}
            onChange={(e) => onChange({ dataType: e.target.value })}
            data-testid={`${testIdPrefix}-type`}
            className="border-input bg-background flex h-8 w-full rounded-md border px-3 py-1 font-mono text-xs shadow-xs"
          />
          <datalist id={`${testIdPrefix}-types`}>
            {typeSuggestions.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>
        {onRemove && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="mt-5"
            onClick={onRemove}
            aria-label="Remove column"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-xs">
          <Checkbox
            checked={column.nullable}
            disabled={disabled}
            onCheckedChange={(d) => onChange({ nullable: !!d.checked })}
          >
            <CheckboxControl />
          </Checkbox>
          Nullable
        </label>
        {showPrimaryKey && (
          <label className="flex items-center gap-2 text-xs">
            <Checkbox
              checked={!!column.primaryKey}
              disabled={disabled}
              onCheckedChange={(d) =>
                onChange({
                  primaryKey: !!d.checked,
                  nullable: d.checked ? false : column.nullable,
                })
              }
            >
              <CheckboxControl />
            </Checkbox>
            Primary key
          </label>
        )}
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Default (SQL expression)</Label>
        <Input
          value={column.defaultValue ?? ""}
          disabled={disabled}
          onChange={(e) => onChange({ defaultValue: e.target.value || null })}
          placeholder="e.g. 0 or 'pending'"
          data-testid={`${testIdPrefix}-default`}
          className="h-8 font-mono text-xs"
        />
      </div>
    </div>
  );
}
