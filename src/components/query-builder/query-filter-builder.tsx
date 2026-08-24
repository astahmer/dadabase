import { type ListCollection, useListCollection } from "@ark-ui/react";
import { useFilter } from "@ark-ui/react/locale";
import { Plus, Trash2, X } from "lucide-react";
import { useEffect, useMemo } from "react";

import type {
  FilterConditionExpression,
  FilterOperatorType,
  LogicalOperatorType,
} from "#src/components/query-builder/query-filter.ts";
import type { TableColumnMetadata } from "#src/server/introspection/introspection.ts";

import { DateFilterCalendar } from "#src/components/query-builder/date-filter-calendar.tsx";
import {
  DATE_FILTER_PRESETS,
  getDateFilterPreset,
} from "#src/components/query-builder/date-filter-presets.ts";
import { getOperatorsForDataType } from "#src/components/query-builder/operators-for-data-type.ts";
import {
  arrayOperators,
  getOperatorLabel,
  getOperatorSymbols,
  nullOperators,
  rangeOperators,
  SPECIAL_VALUES_LIST,
  specialValueSupportedOperators,
} from "#src/components/query-builder/query-filter.ts";
import { isDateTimeDataType } from "#src/lib/data-type-utils.ts";

import { DataTypeBadge } from "../app/data-type-badge.tsx";
import { Button } from "../ui/button.tsx";
import {
  Combobox,
  ComboboxContent,
  ComboboxControl,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  createListCollection,
} from "../ui/combobox.tsx";
import { Input } from "../ui/input.tsx";
import { Kbd } from "../ui/kbd.tsx";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "../ui/menu.tsx";
import { Tooltip } from "../ui/tooltip.tsx";

interface QueryFilterBuilderProps {
  conditions: readonly FilterConditionExpression[];
  onUpdateCondition: (id: string, updates: Partial<FilterConditionExpression>) => void;
  onRemoveCondition: (id: string) => void;
  onAddCondition: () => void;
  onClearAll: () => void;
  onLogicalOperatorChange: (operator: LogicalOperatorType) => void;
  logicalOperator: LogicalOperatorType;
  availableColumns: string[];
  isLoading?: boolean;
  /** Optional table name/alias for display in column headers (useful for joined table filters) */
  tableReference?: string;
  /** Disable the filter builder (e.g., when in custom query mode) */
  disabled?: boolean;
  /** Optional column metadata to display data types in the column dropdown */
  columnMetadata?: Array<TableColumnMetadata>;
  label?: string;
  presentation?: "panel" | "popover";
}

const LogicalOperatorToggle = ({
  logicalOperator,
  onChange,
}: {
  logicalOperator: LogicalOperatorType;
  onChange: (operator: LogicalOperatorType) => void;
}) => (
  <div
    className="bg-muted/70 inline-flex h-8 items-center rounded-md border p-0.5"
    aria-label="Match conditions"
  >
    <Tooltip content="Match every condition">
      <Button
        variant={logicalOperator === "and" ? "secondary" : "ghost"}
        size="sm"
        onClick={() => onChange("and")}
        className="h-6 px-2 text-xs"
        aria-pressed={logicalOperator === "and"}
      >
        All
      </Button>
    </Tooltip>
    <Tooltip content="Match any condition">
      <Button
        variant={logicalOperator === "or" ? "secondary" : "ghost"}
        size="sm"
        onClick={() => onChange("or")}
        className="h-6 px-2 text-xs"
        aria-pressed={logicalOperator === "or"}
      >
        Any
      </Button>
    </Tooltip>
  </div>
);

export const QueryFilterBuilder = ({
  conditions,
  onUpdateCondition,
  onRemoveCondition,
  onAddCondition,
  onClearAll,
  onLogicalOperatorChange,
  logicalOperator,
  availableColumns,
  isLoading = false,
  tableReference,
  disabled = false,
  columnMetadata,
  label = "Where",
  presentation = "panel",
}: QueryFilterBuilderProps) => {
  const columnCollection = useMemo(
    () =>
      createListCollection({
        items: availableColumns.map((col) => ({
          label: tableReference ? `${tableReference}.${col}` : col,
          value: col,
        })),
      }),
    [availableColumns, tableReference],
  );

  return (
    <div
      className={
        presentation === "panel"
          ? `bg-background space-y-3 border-b px-5 py-3 ${disabled ? "pointer-events-none opacity-50" : ""}`
          : `space-y-3 ${disabled ? "pointer-events-none opacity-50" : ""}`
      }
    >
      {presentation === "panel" && (
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">{label} filters</p>
            <p className="text-muted-foreground text-xs">
              {conditions.length
                ? `${conditions.length} condition${conditions.length === 1 ? "" : "s"} applied to this view`
                : "Add conditions to narrow this table view"}
            </p>
          </div>
          {conditions.length > 1 && (
            <LogicalOperatorToggle
              logicalOperator={logicalOperator}
              onChange={onLogicalOperatorChange}
            />
          )}
        </div>
      )}
      {conditions.length > 1 && presentation === "popover" && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground text-xs">Match conditions</span>
          <LogicalOperatorToggle
            logicalOperator={logicalOperator}
            onChange={onLogicalOperatorChange}
          />
        </div>
      )}
      {conditions.length ? (
        <div className="space-y-1.5">
          {conditions.map((condition, index) => (
            <FilterConditionRow
              key={index}
              condition={condition}
              index={index}
              columnCollection={columnCollection}
              onUpdate={onUpdateCondition}
              onRemove={onRemoveCondition}
              isLoading={isLoading}
              connector={index === 0 ? label : logicalOperator === "and" ? "And" : "Or"}
              tableReference={tableReference}
              columnMetadata={columnMetadata}
              compact={presentation === "popover"}
            />
          ))}
        </div>
      ) : (
        <div className="border-border/70 bg-muted/30 flex items-center justify-between gap-3 rounded-md border border-dashed px-3 py-2">
          <span className="text-muted-foreground text-sm">No filter conditions yet</span>
          <Button
            variant="secondary"
            size="sm"
            onClick={onAddCondition}
            disabled={isLoading}
            className="h-8 gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Add filter
          </Button>
        </div>
      )}
      {conditions.length > 0 && (
        <div
          className={
            presentation === "panel"
              ? "ml-12 flex flex-wrap items-center gap-1"
              : "flex flex-wrap items-center gap-1"
          }
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={onAddCondition}
            disabled={isLoading}
            className="text-muted-foreground h-7 gap-1 px-1.5 text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            Add filter
          </Button>
          {(conditions.length > 1 ||
            conditions.some((condition) => condition.column || condition.value !== undefined)) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearAll}
              disabled={isLoading}
              className="text-muted-foreground h-7 gap-1 px-1.5 text-xs"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear all
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

interface FilterConditionRowProps {
  condition: FilterConditionExpression;
  index: number;
  columnCollection: ListCollection<{
    label: string;
    value: string;
  }>;
  onUpdate: (id: string, updates: Partial<FilterConditionExpression>) => void;
  onRemove: (id: string) => void;
  isLoading?: boolean;
  connector: string;
  tableReference?: string;
  columnMetadata?: Array<TableColumnMetadata>;
  compact?: boolean;
}

const FilterConditionRow = (props: FilterConditionRowProps) => {
  const {
    condition,
    index,
    columnCollection,
    onUpdate,
    onRemove,
    isLoading = false,
    connector,
    columnMetadata,
    compact = false,
  } = props;
  const isNullOperator = nullOperators.includes(condition.operator);
  const isArrayOperator = arrayOperators.includes(condition.operator);
  const isRangeOperator = rangeOperators.includes(condition.operator);
  const supportsSpecialValues = specialValueSupportedOperators.includes(condition.operator);

  const columnDataType = columnMetadata?.find((col) => col.name === condition.column)?.dataType;
  const isDateTimeColumn = Boolean(columnDataType && isDateTimeDataType(columnDataType));
  const allowedOperators = useMemo(() => getOperatorsForDataType(columnDataType), [columnDataType]);
  const operatorCollection = useMemo(
    () =>
      createListCollection({
        items: allowedOperators.map((op) => ({
          label: getOperatorLabel(op),
          value: op,
        })),
      }),
    [allowedOperators],
  );

  // If the current operator is invalid for this column type, snap to a safe default
  useEffect(() => {
    if (!allowedOperators.includes(condition.operator) && allowedOperators.length > 0) {
      onUpdate(String(index), { operator: allowedOperators[0] });
    }
  }, [allowedOperators, condition.operator, index, onUpdate]);

  const filters = useFilter({ sensitivity: "base" });
  const columnList = useListCollection({
    initialItems: columnCollection.items,
    filter: filters.contains,
  });
  useEffect(() => {
    columnList.set(columnCollection.items);
  }, [columnCollection.items, columnList.set]);

  const operatorList = useListCollection({
    initialItems: operatorCollection.items,
    filter: filters.contains,
  });
  useEffect(() => {
    operatorList.set(operatorCollection.items);
  }, [operatorCollection.items, operatorList.set]);

  return (
    <div className="flex flex-wrap items-center gap-1.5 py-0.5">
      <span className="text-muted-foreground w-12 text-right text-xs font-medium">{connector}</span>
      <div className={compact ? "w-44 max-w-full" : "w-48 max-w-full"}>
        <Combobox
          openOnClick
          collection={columnList.collection}
          value={condition.column ? [condition.column] : []}
          onValueChange={(details) => {
            onUpdate(String(index), { column: details.value?.[0] || "" });
          }}
          onInputValueChange={(details) => columnList.filter(details.inputValue)}
          className="w-full"
        >
          <ComboboxControl
            size="sm"
            className="bg-muted/70 overflow-hidden border-transparent shadow-none"
          >
            <ComboboxInput placeholder="Column" className="min-w-0" />
            <ComboboxTrigger className="flex h-5 w-5 shrink-0 items-center justify-center" />
          </ComboboxControl>
          <ComboboxContent className="min-w-[22rem]">
            <ComboboxList>
              {columnList.collection.items.map((item) => (
                <ComboboxItem key={item.value} item={item}>
                  <div className="flex w-full items-center justify-between gap-3">
                    <span>{item.label}</span>
                    {columnMetadata && (
                      <div className="ml-auto">
                        <DataTypeBadge
                          dataType={
                            columnMetadata?.find((col) => col.name === item.value)?.dataType || ""
                          }
                        />
                      </div>
                    )}
                  </div>
                </ComboboxItem>
              ))}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </div>

      <div className={compact ? "w-32 max-w-full" : "w-36 max-w-full"}>
        <Combobox
          openOnClick
          collection={operatorList.collection}
          value={[condition.operator]}
          onValueChange={(details) => {
            const nextOp = details.value?.[0] as FilterOperatorType;
            onUpdate(String(index), {
              operator: nextOp,
              ...(rangeOperators.includes(nextOp) && !Array.isArray(condition.value)
                ? { value: ["", ""] }
                : {}),
            });
          }}
          onInputValueChange={(details) => operatorList.filter(details.inputValue)}
          className="w-full"
        >
          <ComboboxControl
            size="sm"
            className="bg-muted/70 overflow-hidden border-transparent shadow-none"
          >
            <ComboboxInput placeholder="Operator" className="min-w-0" />
            <ComboboxTrigger className="flex h-5 w-5 shrink-0 items-center justify-center" />
          </ComboboxControl>
          <ComboboxContent className="min-w-[18rem]">
            <ComboboxList>
              {operatorList.collection.items.map((item) => {
                const symbols = getOperatorSymbols(item.value as FilterOperatorType);
                return (
                  <ComboboxItem key={item.value} item={item}>
                    <div className="flex w-full items-center justify-between gap-3">
                      <span className="text-sm lowercase">{item.label}</span>
                      {symbols.length > 0 && (
                        <div className="ml-auto flex gap-1">
                          {symbols.map((symbol) => (
                            <Kbd
                              key={symbol}
                              variant="outline"
                              size="sm"
                              className="text-xs lowercase"
                            >
                              {symbol}
                            </Kbd>
                          ))}
                        </div>
                      )}
                    </div>
                  </ComboboxItem>
                );
              })}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </div>

      {!isNullOperator && (
        <div
          className={`flex max-w-full items-center gap-1.5 ${isRangeOperator ? "min-w-[20rem]" : compact ? "w-52" : "w-64"}`}
        >
          <div className="min-w-0 flex-1">
            {isRangeOperator ? (
              <div className="flex items-center gap-2">
                <Input
                  className="bg-muted/70 placeholder:text-muted-foreground focus-visible:ring-ring h-8 w-full rounded-md border-transparent text-sm shadow-none focus-visible:ring-1 focus-visible:outline-none"
                  type="text"
                  placeholder="From"
                  value={Array.isArray(condition.value) ? String(condition.value[0] ?? "") : ""}
                  onChange={(e) => {
                    const high = Array.isArray(condition.value)
                      ? String(condition.value[1] ?? "")
                      : "";
                    onUpdate(String(index), { value: [e.target.value, high] });
                  }}
                />
                <span className="text-muted-foreground text-xs">and</span>
                <Input
                  className="bg-muted/70 placeholder:text-muted-foreground focus-visible:ring-ring h-8 w-full rounded-md border-transparent text-sm shadow-none focus-visible:ring-1 focus-visible:outline-none"
                  type="text"
                  placeholder="To"
                  value={Array.isArray(condition.value) ? String(condition.value[1] ?? "") : ""}
                  onChange={(e) => {
                    const low = Array.isArray(condition.value)
                      ? String(condition.value[0] ?? "")
                      : "";
                    onUpdate(String(index), { value: [low, e.target.value] });
                  }}
                />
              </div>
            ) : supportsSpecialValues ? (
              <div className="flex items-center gap-1.5">
                <Input
                  className="bg-muted/70 placeholder:text-muted-foreground focus-visible:ring-ring h-8 w-full rounded-md border-transparent text-sm shadow-none focus-visible:ring-1 focus-visible:outline-none"
                  type="text"
                  placeholder="Value"
                  value={
                    isArrayOperator && Array.isArray(condition.value)
                      ? condition.value.join(", ")
                      : (condition.value as string) || ""
                  }
                  onChange={(e) => {
                    const value = e.target.value;
                    onUpdate(String(index), {
                      value: isArrayOperator ? value.split(",").map((item) => item.trim()) : value,
                    });
                  }}
                />
                <Menu>
                  <MenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 shrink-0 px-2 text-xs"
                      aria-label="Insert SQL value"
                    >
                      Insert
                    </Button>
                  </MenuTrigger>
                  <MenuContent>
                    {SPECIAL_VALUES_LIST.map((item) => (
                      <MenuItem
                        key={item.value}
                        value={item.value}
                        onClick={() =>
                          onUpdate(String(index), {
                            value: isArrayOperator ? [item.value] : item.value,
                          })
                        }
                      >
                        <span className="font-mono text-xs">{item.label}</span>
                      </MenuItem>
                    ))}
                  </MenuContent>
                </Menu>
              </div>
            ) : (
              <Input
                className="bg-muted/70 placeholder:text-muted-foreground focus-visible:ring-ring h-8 w-full rounded-md border-transparent text-sm shadow-none focus-visible:ring-1 focus-visible:outline-none"
                type="text"
                placeholder="Value"
                value={
                  isArrayOperator && Array.isArray(condition.value)
                    ? condition.value.join(", ")
                    : (condition.value as string) || ""
                }
                onChange={(e) => {
                  const val = e.target.value;
                  onUpdate(String(index), {
                    value: isArrayOperator ? val.split(",").map((v) => v.trim()) : val,
                  });
                }}
              />
            )}
          </div>
          {isDateTimeColumn && (
            <>
              <DateFilterCalendar
                value={condition.value}
                onChange={(next) => {
                  onUpdate(String(index), next);
                }}
              />
              <Menu>
                <MenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 shrink-0 px-2 text-xs"
                    title="Date range presets"
                  >
                    Preset
                  </Button>
                </MenuTrigger>
                <MenuContent>
                  {DATE_FILTER_PRESETS.map((preset) => (
                    <MenuItem
                      key={preset.id}
                      value={preset.id}
                      onClick={() => {
                        onUpdate(String(index), getDateFilterPreset(preset.id));
                      }}
                    >
                      {preset.label}
                    </MenuItem>
                  ))}
                </MenuContent>
              </Menu>
            </>
          )}
        </div>
      )}
      <Tooltip content={condition.inverted ? "Remove NOT (inverted)" : "Negate with NOT"}>
        <Button
          type="button"
          variant={condition.inverted ? "secondary" : "ghost"}
          size="sm"
          aria-pressed={Boolean(condition.inverted)}
          aria-label="Invert filter condition"
          data-testid="filter-invert-toggle"
          onClick={() => {
            onUpdate(String(index), { inverted: !condition.inverted });
          }}
          className="text-muted-foreground h-8 shrink-0 px-2 font-mono text-xs"
        >
          NOT
        </Button>
      </Tooltip>
      <Tooltip content="Remove condition">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRemove(String(index))}
          disabled={isLoading}
          className="text-muted-foreground hover:text-foreground h-8 w-8 shrink-0 p-0"
          aria-label="Remove filter condition"
        >
          <X className="h-4 w-4" />
        </Button>
      </Tooltip>
    </div>
  );
};
