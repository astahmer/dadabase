import { Input } from "#src/components/ui/input.tsx";
import { Switch, SwitchControl, SwitchThumb } from "#src/components/ui/switch.tsx";
import { toaster } from "#src/components/ui/toaster.tsx";
import {
  coerceColumnValue,
  isBooleanDataType,
  isNumericDataType,
} from "#src/lib/data-type-utils.ts";
import { getErrorMessage } from "#src/lib/get-error-message.ts";
import { updateRowServerFn } from "#src/server/introspection/start-fns/update-row.start.ts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

export interface InlineCellEditorProps {
  connectionUrl: string;
  schema: string;
  table: string;
  columnName: string;
  dataType: string;
  initialValue: unknown;
  primaryKey: Record<string, unknown>;
  onCancel: () => void;
  onSaved: () => void;
}

export function InlineCellEditor(props: InlineCellEditorProps) {
  const {
    connectionUrl,
    schema,
    table,
    columnName,
    dataType,
    initialValue,
    primaryKey,
    onCancel,
    onSaved,
  } = props;

  const queryClient = useQueryClient();
  const [value, setValue] = useState<unknown>(initialValue ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const saveMutation = useMutation({
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
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["remote", "rows"] });
      toaster.create({
        title: "Saved",
        description: `Updated ${columnName}`,
        type: "success",
      });
      onSaved();
    },
    onError: (error) => {
      toaster.create({
        title: "Error",
        description: getErrorMessage(error),
        type: "error",
      });
    },
  });

  const commit = () => {
    if (saveMutation.isPending) return;
    // Skip no-op saves
    if (Object.is(value, initialValue) || String(value) === String(initialValue ?? "")) {
      onCancel();
      return;
    }
    saveMutation.mutate(value);
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
            saveMutation.mutate(details.checked);
          }}
        >
          <SwitchControl>
            <SwitchThumb />
          </SwitchControl>
        </Switch>
      </div>
    );
  }

  return (
    <div
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
        onBlur={commit}
      />
    </div>
  );
}
