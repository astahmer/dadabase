import { useListCollection } from "@ark-ui/react";
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
import * as ArkSelect from "../ui/select.tsx";
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
}

const logicalOperatorCollection = createListCollection({
  items: [
    { label: "Match all", value: "and" },
    { label: "Match any", value: "or" },
  ],
});

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
  label = "WHERE",
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

  if (conditions.length === 0) {
    return null;
  }

  return (
    <div
      className={`bg-background space-y-1.5 border-b px-5 py-2.5 ${disabled ? "pointer-events-none opacity-50" : ""}`}
    >
      <div className="flex min-h-7 items-center justify-between gap-2">
        {conditions.length > 1 ? (
          <ArkSelect.Select
            value={[logicalOperator]}
            collection={logicalOperatorCollection}
            positioning={{ sameWidth: true }}
            onValueChange={(details: { value?: string[] }) => {
              onLogicalOperatorChange((details.value?.[0] as LogicalOperatorType) || "and");
            }}
          >
            <ArkSelect.SelectControl size="sm" className="bg-muted/70 h-7 shadow-none">
              <ArkSelect.SelectTrigger className="px-2 text-xs">
                <ArkSelect.SelectValueText placeholder="Match all" />
                <ArkSelect.SelectIndicator />
              </ArkSelect.SelectTrigger>
            </ArkSelect.SelectControl>
            <ArkSelect.SelectContent>
              {logicalOperatorCollection.items.map((item) => (
                <ArkSelect.SelectItem key={item.value} item={item}>
                  {item.label}
                </ArkSelect.SelectItem>
              ))}
            </ArkSelect.SelectContent>
          </ArkSelect.Select>
        ) : (
          <span />
        )}
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
      </div>
      <div className="space-y-1">
        {conditions.map((condition, index) => (
          <FilterConditionRow
            key={index}
            condition={condition}
            index={index}
            columnCollection={columnCollection}
            onUpdate={onUpdateCondition}
            onRemove={onRemoveCondition}
            isLoading={isLoading}
            connector={index === 0 ? label : logicalOperator}
            tableReference={tableReference}
            columnMetadata={columnMetadata}
          />
        ))}
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onAddCondition}
        disabled={isLoading}
        className="text-muted-foreground ml-11 h-7 gap-1 px-1.5 text-xs"
      >
        <Plus className="h-3.5 w-3.5" />
        Add condition
      </Button>
    </div>
  );
};

interface FilterConditionRowProps {
  condition: FilterConditionExpression;
  index: number;
  columnCollection: ArkSelect.ListCollection<{
    label: string;
    value: string;
  }>;
  onUpdate: (id: string, updates: Partial<FilterConditionExpression>) => void;
  onRemove: (id: string) => void;
  isLoading?: boolean;
  connector: string;
  tableReference?: string;
  columnMetadata?: Array<TableColumnMetadata>;
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

  const specialValuesCollection = useMemo(
    () => createListCollection({ items: SPECIAL_VALUES_LIST }),
    [],
  );

  return (
    <div className="flex flex-wrap items-center gap-1.5 py-0.5">
      <span className="text-muted-foreground w-10 text-right text-xs font-medium capitalize">
        {connector}
      </span>
      <div className="w-52 max-w-full">
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
          <ComboboxControl size="sm" className="bg-muted/70 border-transparent shadow-none">
            <ComboboxInput placeholder="Column" />
            <ComboboxTrigger />
          </ComboboxControl>
          <ComboboxContent>
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

      <div className="w-40 max-w-full">
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
          <ComboboxControl size="sm" className="bg-muted/70 border-transparent shadow-none">
            <ComboboxInput placeholder="Operator" />
            <ComboboxTrigger />
          </ComboboxControl>
          <ComboboxContent>
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
        <div className="flex min-w-[12rem] flex-1 items-center gap-1.5">
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
              <Combobox
                collection={specialValuesCollection}
                value={
                  isArrayOperator && Array.isArray(condition.value)
                    ? condition.value.map(String)
                    : condition.value
                      ? [String(condition.value)]
                      : []
                }
                onValueChange={(details) => {
                  onUpdate(String(index), {
                    value: details.value.length === 1 ? details.value[0] : details.value || "",
                  });
                }}
                onInputValueChange={(details) => {
                  const val = details.inputValue;
                  if (!val || val.trim() === "") return;
                  onUpdate(String(index), {
                    value: isArrayOperator ? val.split(",").map((v) => v.trim()) : val,
                  });
                }}
                allowCustomValue
                openOnClick
              >
                <ComboboxControl size="sm" className="bg-muted/70 border-transparent shadow-none">
                  <ComboboxInput
                    placeholder="Value or select special value..."
                    className="w-full"
                  />
                  <ComboboxTrigger />
                </ComboboxControl>
                <ComboboxContent>
                  <ComboboxList>
                    {specialValuesCollection.items.map((item) => (
                      <ComboboxItem key={item.value} item={item} className="text-sm">
                        <span className="bg-muted rounded px-1.5 py-0.5 font-mono text-xs">
                          {item.label}
                        </span>
                      </ComboboxItem>
                    ))}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
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
