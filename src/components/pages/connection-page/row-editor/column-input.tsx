import type { TableColumnMetadata } from "#src/server/introspection/introspection.ts";

import { Badge } from "#src/components/ui/badge.tsx";
import { Button } from "#src/components/ui/button.tsx";
import { Input } from "#src/components/ui/input.tsx";
import { Switch, SwitchControl, SwitchLabel, SwitchThumb } from "#src/components/ui/switch.tsx";
import { Textarea } from "#src/components/ui/textarea.tsx";
import {
  isBooleanDataType,
  isDateTimeDataType,
  isJsonDataType,
  isNumericDataType,
} from "#src/lib/data-type-utils.ts";

import { FkColumnSelect } from "./fk-column-select.tsx";

export interface ColumnInputProps {
  column: TableColumnMetadata;
  value: unknown;
  connectionUrl: string;
  disabled?: boolean;
  /** When true, value is omitted from INSERT (DB default). */
  omitted?: boolean;
  onOmittedChange?: (omitted: boolean) => void;
  onChange: (value: unknown) => void;
}

export function ColumnInput(props: ColumnInputProps) {
  const { column, value, connectionUrl, disabled, omitted, onOmittedChange, onChange } = props;
  const isNull = value === null;
  const canOmit = onOmittedChange != null;

  return (
    <div className="flex flex-col gap-1.5" data-testid={`column-input-${column.name}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-sm font-medium">{column.name}</span>
          <span className="text-muted-foreground truncate text-xs">{column.dataType}</span>
          {column.primaryKey && (
            <Badge variant="outline" className="text-[10px]">
              PK
            </Badge>
          )}
          {column.isForeignKey && (
            <Badge variant="outline" className="text-[10px]">
              FK
            </Badge>
          )}
          {!column.nullable && (
            <Badge variant="outline" className="text-[10px]">
              required
            </Badge>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {canOmit && (
            <Button
              type="button"
              size="xs"
              variant={omitted ? "default" : "outline"}
              onClick={() => onOmittedChange?.(!omitted)}
              disabled={disabled}
            >
              Default
            </Button>
          )}
          {column.nullable && !omitted && (
            <Button
              type="button"
              size="xs"
              variant={isNull ? "default" : "outline"}
              onClick={() => onChange(isNull ? emptyValueForColumn(column) : null)}
              disabled={disabled}
            >
              NULL
            </Button>
          )}
        </div>
      </div>

      {omitted ? (
        <p className="text-muted-foreground text-xs">Using database default / auto value</p>
      ) : isNull ? (
        <p className="text-muted-foreground rounded-md border border-dashed px-3 py-2 text-xs">
          NULL
        </p>
      ) : (
        <ColumnValueControl
          column={column}
          value={value}
          connectionUrl={connectionUrl}
          disabled={disabled}
          onChange={onChange}
        />
      )}
    </div>
  );
}

function emptyValueForColumn(column: TableColumnMetadata): unknown {
  if (isBooleanDataType(column.dataType)) return false;
  if (isNumericDataType(column.dataType)) return "";
  if (isJsonDataType(column.dataType)) return "{}";
  return "";
}

function ColumnValueControl(props: {
  column: TableColumnMetadata;
  value: unknown;
  connectionUrl: string;
  disabled?: boolean;
  onChange: (value: unknown) => void;
}) {
  const { column, value, connectionUrl, disabled, onChange } = props;

  if (column.isForeignKey && column.foreignKey) {
    return (
      <FkColumnSelect
        connectionUrl={connectionUrl}
        referencedSchema={column.foreignKey.referencedSchema}
        referencedTable={column.foreignKey.referencedTable}
        referencedColumn={column.foreignKey.referencedColumn}
        value={value}
        disabled={disabled}
        onChange={onChange}
      />
    );
  }

  if (isBooleanDataType(column.dataType)) {
    return (
      <Switch
        checked={Boolean(value)}
        disabled={disabled}
        onCheckedChange={(details) => onChange(details.checked)}
      >
        <SwitchControl>
          <SwitchThumb />
        </SwitchControl>
        <SwitchLabel className="ml-2">{value ? "true" : "false"}</SwitchLabel>
      </Switch>
    );
  }

  if (isJsonDataType(column.dataType)) {
    return (
      <Textarea
        value={
          typeof value === "string" ? value : value == null ? "" : JSON.stringify(value, null, 2)
        }
        disabled={disabled}
        rows={4}
        className="font-mono text-xs"
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  if (isDateTimeDataType(column.dataType)) {
    const stringValue = value == null ? "" : String(value);
    const inputType =
      column.dataType.toLowerCase().includes("date") &&
      !column.dataType.toLowerCase().includes("time")
        ? "date"
        : "datetime-local";

    // datetime-local wants YYYY-MM-DDTHH:mm
    const localValue =
      inputType === "datetime-local" && stringValue.includes("T")
        ? stringValue.slice(0, 16)
        : stringValue.slice(0, 10);

    return (
      <Input
        type={inputType}
        value={localValue}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value ? e.target.value : null)}
      />
    );
  }

  if (isNumericDataType(column.dataType)) {
    return (
      <Input
        type="number"
        value={value == null ? "" : String(value)}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value === "" ? "" : e.target.value)}
      />
    );
  }

  return (
    <Input
      type="text"
      value={value == null ? "" : String(value)}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
