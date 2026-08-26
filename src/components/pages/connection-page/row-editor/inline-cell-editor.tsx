import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { Button } from "#src/components/ui/button.tsx";
import { Input } from "#src/components/ui/input.tsx";
import { Switch, SwitchControl, SwitchThumb } from "#src/components/ui/switch.tsx";
import { toaster } from "#src/components/ui/toaster.tsx";
import { noteRowMutations } from "#src/lib/csv-unsaved-changes.ts";
import {
  coerceColumnValue,
  isBooleanDataType,
  isDateTimeDataType,
  isNumericDataType,
  nowValueForDataType,
} from "#src/lib/data-type-utils.ts";
import { formatDbError } from "#src/lib/format-db-error.ts";
import { invalidateRowsQueries, rowMutationMeta } from "#src/lib/invalidate-rows-queries.ts";
import { updateRowServerFn } from "#src/server/introspection/start-fns/update-row.start.ts";

import { usePendingCellEdits } from "./pending-cell-edits-context.tsx";

export interface InlineCellEditorProps {
  connectionUrl: string;
  schema: string;
  table: string;
  columnName: string;
  dataType: string;
  nullable?: boolean;
  initialValue: unknown;
  primaryKey: Record<string, unknown>;
  onCancel: () => void;
  onSaved: () => void;
}

type RowsCache = {
  rows: Array<Record<string, unknown>>;
  [key: string]: unknown;
};

function rowMatchesPrimaryKey(row: Record<string, unknown>, primaryKey: Record<string, unknown>) {
  return Object.entries(primaryKey).every(([key, value]) => String(row[key]) === String(value));
}

function valuesEqual(a: unknown, b: unknown) {
  if (Object.is(a, b)) return true;
  if (a == null && b == null) return a === b;
  return String(a ?? "") === String(b ?? "");
}

export function InlineCellEditor(props: InlineCellEditorProps) {
  const {
    connectionUrl,
    schema,
    table,
    columnName,
    dataType,
    nullable = false,
    initialValue,
    primaryKey,
    onCancel,
    onSaved,
  } = props;

  const queryClient = useQueryClient();
  const pendingEdits = usePendingCellEdits();
  const [value, setValue] = useState<unknown>(initialValue ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const saveMutation = useMutation({
    meta: rowMutationMeta,
    mutationFn: async (nextValue: unknown) => {
      return updateRowServerFn({
        data: {
          url: connectionUrl,
          schema,
          table,
          primaryKey: primaryKey as Record<string, string | number | boolean | null | undefined>,
          values: {
            [columnName]: coerceColumnValue(dataType, nextValue) as
              | string
              | number
              | boolean
              | null
              | undefined,
          },
        },
      });
    },
    onMutate: async (nextValue) => {
      await queryClient.cancelQueries({ queryKey: ["remote", "rows"] });
      const previous = queryClient.getQueriesData<RowsCache>({ queryKey: ["remote", "rows"] });
      const coerced = coerceColumnValue(dataType, nextValue);

      queryClient.setQueriesData<RowsCache>({ queryKey: ["remote", "rows"] }, (old) => {
        if (!old?.rows) return old;
        return {
          ...old,
          rows: old.rows.map((row) =>
            rowMatchesPrimaryKey(row, primaryKey) ? { ...row, [columnName]: coerced } : row,
          ),
        };
      });

      onSaved();
      return { previous };
    },
    onError: (error, _nextValue, context) => {
      context?.previous.forEach(([key, data]) => {
        queryClient.setQueryData(key, data);
      });
      toaster.create({
        title: "Could not save cell",
        description: formatDbError(error),
        type: "error",
      });
    },
    onSuccess: () => {
      noteRowMutations(connectionUrl, table);
      toaster.create({
        title: "Saved",
        description: `Updated ${columnName}`,
        type: "success",
      });
    },
    onSettled: () => {
      invalidateRowsQueries(queryClient);
    },
  });

  const normalizeForCommit = (next: unknown) => {
    if (nullable && typeof next === "string" && next.trim() === "") {
      return null;
    }
    return next;
  };

  const commit = (override?: unknown) => {
    if (saveMutation.isPending) return;
    const next = normalizeForCommit(override !== undefined ? override : value);
    if (valuesEqual(next, initialValue)) {
      onCancel();
      return;
    }

    // Buffer into pending-edits commit phase when provider is present
    if (pendingEdits) {
      pendingEdits.bufferEdit({
        schema,
        table,
        column: columnName,
        dataType,
        primaryKey,
        previousValue: initialValue,
        nextValue: coerceColumnValue(dataType, next),
      });
      onSaved();
      return;
    }

    saveMutation.mutate(next);
  };

  if (isBooleanDataType(dataType)) {
    return (
      <div
        className="flex items-center gap-2"
        data-testid="inline-cell-editor"
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onCancel();
          }
        }}
      >
        <Switch
          checked={Boolean(value)}
          disabled={saveMutation.isPending}
          onCheckedChange={(details) => {
            setValue(details.checked);
            if (pendingEdits) {
              commit(details.checked);
            } else {
              saveMutation.mutate(details.checked);
            }
          }}
        >
          <SwitchControl>
            <SwitchThumb />
          </SwitchControl>
        </Switch>
        {nullable && (
          <Button
            type="button"
            size="xs"
            variant={value === null ? "default" : "outline"}
            disabled={saveMutation.isPending}
            onClick={() => commit(null)}
          >
            NULL
          </Button>
        )}
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-1"
      data-testid="inline-cell-editor"
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
      }}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <Input
        ref={inputRef}
        size="sm"
        type={isNumericDataType(dataType) ? "number" : "text"}
        value={value == null ? "" : String(value)}
        disabled={saveMutation.isPending}
        className="h-7 min-w-[6rem]"
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => commit()}
      />
      {isDateTimeDataType(dataType) && (
        <span onMouseDown={(e) => e.preventDefault()}>
          <Button
            type="button"
            size="xs"
            variant="outline"
            disabled={saveMutation.isPending}
            onClick={() => {
              const next = nowValueForDataType(dataType);
              setValue(next);
              commit(next);
            }}
          >
            Now
          </Button>
        </span>
      )}
      {nullable && (
        <span onMouseDown={(e) => e.preventDefault()}>
          <Button
            type="button"
            size="xs"
            variant={value === null ? "default" : "outline"}
            disabled={saveMutation.isPending}
            onClick={() => commit(null)}
          >
            NULL
          </Button>
        </span>
      )}
    </div>
  );
}
