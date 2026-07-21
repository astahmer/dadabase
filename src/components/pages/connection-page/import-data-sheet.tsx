import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { Button } from "#src/components/ui/button.tsx";
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
import {
  buildInsertPreviewSql,
  inferColumnTypes,
  parseCsv,
  parseJsonRows,
  type InferredColumnType,
} from "#src/lib/data-import/index.ts";
import { formatDbError } from "#src/lib/format-db-error.ts";
import { getErrorMessage } from "#src/lib/get-error-message.ts";
import { executeCustomSqlServerFn } from "#src/server/introspection/start-fns/execute-custom-sql.start.ts";

import { invalidateSchemaMetadataQueries } from "./invalidate-schema-metadata.ts";

export interface ImportDataSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionUrl: string;
  dialect: DatabaseDialect;
  schema: string;
  table: string;
  onSuccess?: () => void;
}

type ImportFormat = "csv" | "json";

function dialectForPreview(dialect: DatabaseDialect): "postgres" | "sqlite" {
  return dialect === DatabaseDialect.Postgres ? "postgres" : "sqlite";
}

export function ImportDataSheet(props: ImportDataSheetProps) {
  const { open, onOpenChange, connectionUrl, dialect, schema, table, onSuccess } = props;
  const queryClient = useQueryClient();
  const [format, setFormat] = useState<ImportFormat>("csv");
  const [fileName, setFileName] = useState<string | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [columnTypes, setColumnTypes] = useState<Record<string, InferredColumnType>>({});
  const [error, setError] = useState<string | null>(null);
  const [targetTable, setTargetTable] = useState(table);

  const previewSql = useMemo(() => {
    if (!targetTable.trim() || columns.length === 0 || rows.length === 0) return "";
    try {
      return buildInsertPreviewSql({
        dialect: dialectForPreview(dialect),
        schema,
        table: targetTable.trim(),
        columns,
        rows,
        columnTypes,
        maxRows: 20,
      });
    } catch (e) {
      return `-- ${getErrorMessage(e)}`;
    }
  }, [columnTypes, columns, dialect, rows, schema, targetTable]);

  const mutation = useMutation({
    mutationFn: async (sql: string) => {
      const blocked = guardReadOnlyMutation(connectionUrl);
      if (blocked) throw new Error(blocked);
      return executeCustomSqlServerFn({ data: { url: connectionUrl, sql } });
    },
    onSuccess: async () => {
      toaster.create({ title: `Imported ${rows.length} row(s)` });
      await invalidateSchemaMetadataQueries(queryClient, {
        url: connectionUrl,
        schema,
      });
      void queryClient.invalidateQueries({ queryKey: ["remote"] });
      onSuccess?.();
      onOpenChange(false);
    },
    onError: (e) => {
      toaster.create({ title: formatDbError(getErrorMessage(e)), type: "error" });
    },
  });

  const reset = () => {
    setFileName(null);
    setColumns([]);
    setRows([]);
    setColumnTypes({});
    setError(null);
  };

  const onFile = async (file: File | null) => {
    reset();
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    try {
      if (format === "csv" || file.name.toLowerCase().endsWith(".csv")) {
        const parsed = parseCsv(text, { hasHeader: true });
        const cols = parsed.header ?? [];
        setColumns(cols);
        setRows(parsed.records as Array<Record<string, unknown>>);
        setColumnTypes(inferColumnTypes(parsed.records, cols));
        setFormat("csv");
      } else {
        const parsedRows = parseJsonRows(text);
        const cols =
          parsedRows.length > 0 ? Object.keys(parsedRows[0] as object) : ([] as string[]);
        setColumns(cols);
        setRows(parsedRows);
        setColumnTypes(inferColumnTypes(parsedRows, cols));
        setFormat("json");
      }
    } catch (e) {
      setError(getErrorMessage(e));
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(details) => {
        if (!details.open) reset();
        onOpenChange(details.open);
      }}
    >
      <SheetContent className="sm:max-w-xl" data-testid="import-data-sheet">
        <SheetHeader>
          <SheetTitle>Import data</SheetTitle>
          <SheetDescription>CSV or JSON → typed INSERT preview → run.</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 overflow-auto px-1 py-4">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={format === "csv" ? "default" : "outline"}
              onClick={() => setFormat("csv")}
              data-testid="import-format-csv"
            >
              CSV
            </Button>
            <Button
              size="sm"
              variant={format === "json" ? "default" : "outline"}
              onClick={() => setFormat("json")}
              data-testid="import-format-json"
            >
              JSON
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="import-table">Target table</Label>
            <Input
              id="import-table"
              data-testid="import-target-table"
              value={targetTable}
              onChange={(e) => setTargetTable(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="import-file">File</Label>
            <input
              id="import-file"
              data-testid="import-file-input"
              type="file"
              accept={format === "csv" ? ".csv,text/csv" : ".json,application/json"}
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
              onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
            />
            {fileName ? (
              <p className="text-muted-foreground text-xs">
                {fileName} — {rows.length} row(s), {columns.length} column(s)
              </p>
            ) : null}
            {error ? <p className="text-destructive text-sm">{error}</p> : null}
          </div>

          {columns.length > 0 ? (
            <div className="space-y-2">
              <Label>Inferred types</Label>
              <ul className="text-muted-foreground max-h-28 overflow-auto font-mono text-xs">
                {columns.map((col) => (
                  <li key={col}>
                    {col}: {columnTypes[col] ?? "text"}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {previewSql ? (
            <div className="space-y-2">
              <Label>SQL preview</Label>
              <pre
                data-testid="import-sql-preview"
                className="bg-muted max-h-48 overflow-auto rounded-md p-3 font-mono text-xs whitespace-pre-wrap"
              >
                {previewSql}
              </pre>
            </div>
          ) : null}
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            data-testid="import-run"
            disabled={!previewSql || rows.length === 0 || mutation.isPending}
            onClick={() => {
              const sql = buildInsertPreviewSql({
                dialect: dialectForPreview(dialect),
                schema,
                table: targetTable.trim(),
                columns,
                rows,
                columnTypes,
                maxRows: rows.length,
              });
              mutation.mutate(sql);
            }}
          >
            {mutation.isPending ? "Importing…" : "Run import"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
