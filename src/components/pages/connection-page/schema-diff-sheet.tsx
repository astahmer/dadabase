import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { Button } from "#src/components/ui/button.tsx";
import { Label } from "#src/components/ui/label.tsx";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "#src/components/ui/sheet.tsx";
import { Textarea } from "#src/components/ui/textarea.tsx";
import { toaster } from "#src/components/ui/toaster.tsx";
import { DatabaseDialect } from "#src/db/dialect.ts";
import { guardReadOnlyMutation } from "#src/lib/connection-security.ts";
import { formatDbError } from "#src/lib/format-db-error.ts";
import { getErrorMessage } from "#src/lib/get-error-message.ts";
import {
  buildMigrationSql,
  diffTableStructures,
  type SchemaDiffDialect,
  type TableStructure,
} from "#src/lib/schema-diff/index.ts";
import { executeCustomSqlServerFn } from "#src/server/introspection/start-fns/execute-custom-sql.start.ts";

import { DestructiveQueryConfirmDialog } from "./destructive-query-confirm.dialog.tsx";
import { invalidateSchemaMetadataQueries } from "./invalidate-schema-metadata.ts";

export interface SchemaDiffSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionUrl: string;
  dialect: DatabaseDialect;
  schema: string;
  /** Current live structures (left side of the diff). */
  currentStructures: TableStructure[];
}

function toDiffDialect(dialect: DatabaseDialect): SchemaDiffDialect {
  return dialect === DatabaseDialect.Postgres ? "postgres" : "sqlite";
}

function parseStructuresJson(text: string): TableStructure[] {
  const parsed: unknown = JSON.parse(text);
  if (Array.isArray(parsed)) return parsed as TableStructure[];
  if (
    typeof parsed === "object" &&
    parsed !== null &&
    Array.isArray((parsed as { tables?: unknown }).tables)
  ) {
    return (parsed as { tables: TableStructure[] }).tables;
  }
  throw new Error("Expected a JSON array of table structures, or { tables: [...] }");
}

export function SchemaDiffSheet(props: SchemaDiffSheetProps) {
  const { open, onOpenChange, connectionUrl, dialect, schema, currentStructures } = props;
  const queryClient = useQueryClient();
  const [otherJson, setOtherJson] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { otherStructures, parseError } = useMemo(() => {
    if (!otherJson.trim()) return { otherStructures: null, parseError: null as string | null };
    try {
      return { otherStructures: parseStructuresJson(otherJson), parseError: null };
    } catch (e) {
      return { otherStructures: null, parseError: getErrorMessage(e) };
    }
  }, [otherJson]);

  const ops = useMemo(() => {
    if (!otherStructures) return [];
    return diffTableStructures(currentStructures, otherStructures);
  }, [currentStructures, otherStructures]);

  const migrationSql = useMemo(() => {
    if (ops.length === 0) return "";
    return buildMigrationSql(ops, toDiffDialect(dialect));
  }, [dialect, ops]);

  const mutation = useMutation({
    mutationFn: async (sql: string) => {
      const blocked = guardReadOnlyMutation(connectionUrl);
      if (blocked) throw new Error(blocked);
      return executeCustomSqlServerFn({ data: { url: connectionUrl, sql } });
    },
    onSuccess: async () => {
      toaster.create({ title: "Migration applied" });
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

  return (
    <>
      <Sheet open={open} onOpenChange={(details) => onOpenChange(details.open)}>
        <SheetContent className="sm:max-w-xl" data-testid="schema-diff-sheet">
          <SheetHeader>
            <SheetTitle>Schema diff</SheetTitle>
            <SheetDescription>
              Compare live schema to pasted structure JSON and preview migration SQL.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-4 overflow-auto px-1 py-4">
            <div className="space-y-2">
              <Label htmlFor="schema-diff-json">Other structures (JSON)</Label>
              <Textarea
                id="schema-diff-json"
                data-testid="schema-diff-json"
                className="min-h-40 font-mono text-xs"
                placeholder='[{"schema":"main","table":"users","columns":[...]}]'
                value={otherJson}
                onChange={(e) => setOtherJson(e.target.value)}
              />
              {parseError ? <p className="text-destructive text-sm">{parseError}</p> : null}
            </div>

            <div className="space-y-2">
              <Label>Ops ({ops.length})</Label>
              <ul
                data-testid="schema-diff-ops"
                className="bg-muted max-h-32 overflow-auto rounded-md p-2 font-mono text-xs"
              >
                {ops.length === 0 ? (
                  <li className="text-muted-foreground">No differences</li>
                ) : (
                  ops.map((op, i) => <li key={i}>{JSON.stringify(op)}</li>)
                )}
              </ul>
            </div>

            {migrationSql ? (
              <div className="space-y-2">
                <Label>Migration SQL</Label>
                <pre
                  data-testid="schema-diff-sql"
                  className="bg-muted max-h-48 overflow-auto rounded-md p-3 font-mono text-xs whitespace-pre-wrap"
                >
                  {migrationSql}
                </pre>
              </div>
            ) : null}
          </div>

          <SheetFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button
              data-testid="schema-diff-run"
              disabled={!migrationSql || mutation.isPending}
              onClick={() => setConfirmOpen(true)}
            >
              Run migration
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <DestructiveQueryConfirmDialog
        isOpen={confirmOpen}
        queryType="apply schema migration"
        isLoading={mutation.isPending}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          mutation.mutate(migrationSql);
        }}
      />
    </>
  );
}
