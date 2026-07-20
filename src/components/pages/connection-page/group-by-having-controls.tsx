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
import { HStack, Stack } from "../../ui/layout.tsx";

interface GroupByHavingControlsProps {
  availableColumns: string[];
  groupBy: string[];
  onGroupByChange: (groupBy: string[]) => void;
  havingBuilder: QueryFilterBuilderReturn;
  isLoading?: boolean;
}

/**
 * UI to manage GROUP BY columns and HAVING conditions (wired to tab state / SQL generation).
 */
export const GroupByHavingControls = (props: GroupByHavingControlsProps) => {
  const { availableColumns, groupBy, onGroupByChange, havingBuilder, isLoading } = props;
  const [pendingColumn, setPendingColumn] = useState<string>("");

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
    <div className="border-b">
      <div className="space-y-3 p-4 pb-2">
        <Stack gap="2">
          <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Group by
          </div>
          <HStack className="flex-wrap items-center gap-2">
            {groupBy.map((col) => (
              <Button
                key={col}
                variant="secondary"
                size="sm"
                className="gap-1.5"
                onClick={() => onGroupByChange(removeGroupByColumn(groupBy, col))}
                disabled={isLoading}
                title={`Remove ${col} from GROUP BY`}
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
                <SelectTrigger className="min-w-40">
                  <SelectValueText placeholder="Add column…" />
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
            {groupBy.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onGroupByChange([])}
                disabled={isLoading}
              >
                Clear
              </Button>
            )}
          </HStack>
        </Stack>

        <HStack className="items-center justify-between">
          <div className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
            Having
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => havingBuilder.addCondition()}
            disabled={isLoading || groupBy.length === 0}
            title={groupBy.length === 0 ? "Add GROUP BY columns first" : "Add HAVING condition"}
          >
            <Plus className="h-3 w-3" />
            Add condition
          </Button>
        </HStack>
        {havingBuilder.filter.conditions.length === 0 && (
          <p className="text-muted-foreground text-xs">
            {groupBy.length === 0
              ? "Add GROUP BY columns to enable HAVING filters."
              : "No HAVING conditions yet."}
          </p>
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
        />
      )}
    </div>
  );
};
