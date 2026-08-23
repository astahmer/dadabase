import { Plus, X } from "lucide-react";
import { useMemo, useState } from "react";

import type { QueryFilterBuilderReturn } from "#src/components/query-builder/use-query-builder.ts";

import {
  addGroupByColumn,
  HAVING_EXPRESSION_SUGGESTIONS,
  removeGroupByColumn,
} from "#src/components/query-builder/group-by-columns.ts";
import { QueryFilterBuilder } from "#src/components/query-builder/query-filter-builder.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValueText,
  createListCollection,
} from "#src/components/ui/select.tsx";

import { Button } from "../../ui/button.tsx";

interface GroupByHavingControlsProps {
  availableColumns: string[];
  groupBy: string[];
  onGroupByChange: (groupBy: string[]) => void;
  havingBuilder: QueryFilterBuilderReturn;
  isLoading?: boolean;
  presentation?: "panel" | "popover";
}

export const GroupByHavingControls = (props: GroupByHavingControlsProps) => {
  const {
    availableColumns,
    groupBy,
    onGroupByChange,
    havingBuilder,
    isLoading,
    presentation = "panel",
  } = props;
  const [pendingColumn, setPendingColumn] = useState<string>("");
  const [isGroupBuilderOpen, setIsGroupBuilderOpen] = useState(groupBy.length > 0);

  const unusedColumns = useMemo(
    () => availableColumns.filter((c) => !groupBy.includes(c)),
    [availableColumns, groupBy],
  );

  const columnItems = useMemo(
    () => unusedColumns.map((col) => ({ label: col, value: col })),
    [unusedColumns],
  );

  const columnCollection = useMemo(
    () => createListCollection({ items: columnItems }),
    [columnItems],
  );

  const havingColumns = useMemo(() => {
    const suggestions = [...HAVING_EXPRESSION_SUGGESTIONS];
    return Array.from(new Set([...groupBy, ...availableColumns, ...suggestions]));
  }, [availableColumns, groupBy]);

  return (
    <div className={presentation === "panel" ? "bg-background border-b px-5 py-2" : "px-0 py-0"}>
      <div className="flex flex-wrap items-center gap-1.5">
        {isGroupBuilderOpen ? (
          <>
            <span className="text-muted-foreground mr-1 text-sm">Group by</span>
            {groupBy.map((col) => (
              <Button
                key={col}
                variant="secondary"
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
                onClick={() => onGroupByChange(removeGroupByColumn(groupBy, col))}
                disabled={isLoading}
              >
                {col}
                <X className="h-3 w-3" />
              </Button>
            ))}
            {unusedColumns.length > 0 && (
              <Select
                collection={columnCollection}
                value={pendingColumn ? [pendingColumn] : []}
                onValueChange={(details) => {
                  const next = details.value?.[0] ?? "";
                  setPendingColumn(next);
                  if (next) {
                    onGroupByChange(addGroupByColumn(groupBy, next));
                    setPendingColumn("");
                  }
                }}
                disabled={isLoading}
                positioning={{ sameWidth: true }}
              >
                <SelectTrigger className="bg-muted hover:bg-muted/70 h-7 min-w-36 rounded-md px-2 text-xs">
                  <SelectValueText placeholder="Add property…" />
                </SelectTrigger>
                <SelectContent>
                  {columnItems.map((item) => (
                    <SelectItem key={item.value} item={item}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {groupBy.length > 0 && havingBuilder.filter.conditions.length === 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground h-7 gap-1 px-2 text-xs"
                onClick={() => havingBuilder.addCondition()}
                disabled={isLoading}
              >
                <Plus className="h-3.5 w-3.5" />
                Add aggregate filter
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground h-7 px-2 text-xs"
              onClick={() => {
                onGroupByChange([]);
                setIsGroupBuilderOpen(false);
              }}
              disabled={isLoading}
            >
              Remove grouping
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground h-7 gap-1 px-2 text-xs"
            onClick={() => setIsGroupBuilderOpen(true)}
            disabled={isLoading}
          >
            <Plus className="h-3.5 w-3.5" />
            Add grouping
          </Button>
        )}
      </div>
      {havingBuilder.filter.conditions.length > 0 && (
        <QueryFilterBuilder
          conditions={havingBuilder.filter.conditions}
          onUpdateCondition={havingBuilder.updateCondition}
          onRemoveCondition={havingBuilder.removeCondition}
          onLogicalOperatorChange={havingBuilder.setLogicalOperator}
          onAddCondition={havingBuilder.addCondition}
          onClearAll={havingBuilder.clearConditions}
          logicalOperator={havingBuilder.filter.logicalOperator}
          availableColumns={havingColumns}
          isLoading={isLoading}
          disabled={groupBy.length === 0}
          label="Having"
          presentation={presentation}
        />
      )}
    </div>
  );
};
