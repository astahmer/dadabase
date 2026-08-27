import { Clipboard, useFilter, useListCollection } from "@ark-ui/react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Link as LinkIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { ColumnReference } from "#src/server/introspection/introspection.ts";

import { findColumnReferencesWithCountsQueryOptions } from "#src/server/introspection/start-fns/find-column-references.start.ts";

import { ErrorBoundaryCard } from "../../../shared/error-boundary-card.tsx";
import { HStack, Stack } from "../../../ui/layout.tsx";
import {
  ListboxMenuFilterContainer,
  ListboxMenuFilterInput,
  ListboxMenuItem,
  ListboxMenuList,
  ListboxRoot,
} from "../../../ui/listbox-menu.tsx";
import {
  createListCollection,
  Select,
  SelectContent,
  SelectControl,
  SelectItem,
  SelectList,
  SelectTrigger,
  SelectValueText,
} from "../../../ui/select.tsx";
import { Spinner } from "../../../ui/spinner.tsx";

export interface QuickReferencesPanelProps {
  schema: string;
  table: string;
  column: {
    name: string;
    dataType: string;
    nullable: boolean;
    primaryKey: boolean;
    unique: boolean;
    defaultValue: string | null;
    isForeignKey?: boolean;
    foreignKey?: {
      referencedSchema: string;
      referencedTable: string;
      referencedColumn: string;
    };
  };
  cellValue: unknown;
  connectionUrl: string;
  onNavigate?: (schema: string, table: string, column: string, value: unknown) => void;
}

export function QuickReferencesPanel({
  schema,
  table,
  column,
  cellValue,
  connectionUrl,
  onNavigate,
}: QuickReferencesPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(["forward-fk", "reverse-fk"]),
  );
  const [sortBy, setSortBy] = useState<"name" | "count">("name");

  // Fetch reverse FK references for any column
  // If this column is a FK, get references to the target column
  // Otherwise, get references to this column itself
  const referenceTarget = column.foreignKey
    ? {
        referencedSchema: column.foreignKey.referencedSchema,
        referencedTable: column.foreignKey.referencedTable,
        referencedColumn: column.foreignKey.referencedColumn,
      }
    : {
        referencedSchema: schema,
        referencedTable: table,
        referencedColumn: column.name,
      };

  const {
    data: reverseReferences = [],
    isLoading: isLoadingReferences,
    error: referencesError,
    refetch: refetchReferences,
  } = useQuery(
    findColumnReferencesWithCountsQueryOptions({
      url: connectionUrl,
      referencedSchema: referenceTarget.referencedSchema,
      referencedTable: referenceTarget.referencedTable,
      referencedColumn: referenceTarget.referencedColumn,
      cellValue,
    }),
  );

  const toggleSection = (sectionId: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(sectionId)) {
      newExpanded.delete(sectionId);
    } else {
      newExpanded.add(sectionId);
    }
    setExpandedSections(newExpanded);
  };

  const handleNavigateToReference = (ref: ColumnReference) => {
    if (onNavigate && cellValue !== null) {
      onNavigate(ref.schema, ref.table, ref.column, cellValue);
    }
  };

  const forwardFKsExist = column.foreignKey !== undefined;
  const reverseReferencesExist = (reverseReferences?.length ?? 0) > 0;

  // Create list collection items from references
  const referenceItems = useMemo(() => {
    let items = reverseReferences.map((ref) => ({
      label: `${ref.table}.${ref.column}`,
      value: `${ref.schema}.${ref.table}.${ref.column}`,
      ref,
    }));

    // Sort based on sortBy state
    if (sortBy === "count") {
      items.sort(
        (a, b) => Number(b.ref.matchingRowCount ?? 0) - Number(a.ref.matchingRowCount ?? 0),
      );
    } else {
      // Default sort by name (A-Z ascending)
      items.sort((a, b) => a.label.localeCompare(b.label));
    }

    return items;
  }, [reverseReferences, sortBy]);

  const filters = useFilter({ sensitivity: "base" });
  const refList = useListCollection({
    initialItems: referenceItems,
    filter: filters.contains,
  });

  useEffect(() => {
    refList.set(referenceItems);
  }, [referenceItems, refList.set]);

  return (
    <div className="flex h-full w-full flex-col space-y-0 overflow-hidden">
      {/* Header - Column Info */}
      <div className="from-background to-background/95 shrink-0 border-b bg-linear-to-b px-4 py-3">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Relationships for
            </p>
            <code className="text-muted-foreground font-mono text-xs font-bold">
              {schema}.{table}.{column.name}
            </code>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-muted-foreground text-xs">
                {cellValue === null
                  ? "NULL"
                  : String(cellValue).slice(0, 100) + (String(cellValue).length > 100 ? "..." : "")}
              </span>
            </div>
          </div>
        </div>

        {/* Value Copy */}
        {cellValue !== null && (
          <Clipboard.Root value={String(cellValue)}>
            <Clipboard.Trigger asChild>
              <button className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-xs transition-colors">
                <Clipboard.Indicator
                  copied={
                    <HStack align="center">
                      <Check className="h-3 w-3" />
                      Copied
                    </HStack>
                  }
                >
                  <HStack align="center">
                    <Copy className="h-3 w-3" />
                    Copy value
                  </HStack>
                </Clipboard.Indicator>
              </button>
            </Clipboard.Trigger>
          </Clipboard.Root>
        )}
      </div>
      {/* Content */}
      <Stack className="min-h-0 flex-1 overflow-y-auto">
        {cellValue === null && (
          <div className="m-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="text-sm text-amber-900 dark:text-amber-100">
                Cannot display relationships for NULL values
              </div>
            </div>
          </div>
        )}

        {/* Forward FK Section */}
        {cellValue !== null && forwardFKsExist && (
          <div>
            <button
              onClick={() => toggleSection("forward-fk")}
              className="hover:bg-muted/50 flex w-full items-center justify-between px-4 py-3 transition-colors"
            >
              <div className="flex items-center gap-2">
                {expandedSections.has("forward-fk") ? (
                  <ChevronDown className="text-muted-foreground h-4 w-4" />
                ) : (
                  <ChevronRight className="text-muted-foreground h-4 w-4" />
                )}
                <LinkIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-semibold">From source table</span>
              </div>
            </button>

            {expandedSections.has("forward-fk") && column.foreignKey && (
              <div className="bg-muted/20 px-0 pb-0">
                {onNavigate && (
                  <button
                    onClick={() => {
                      if (column.foreignKey) {
                        onNavigate(
                          column.foreignKey.referencedSchema,
                          column.foreignKey.referencedTable,
                          column.foreignKey.referencedColumn,
                          cellValue,
                        );
                      }
                    }}
                    className="hover:bg-muted/70 group hover:border-foreground flex w-full items-center justify-between gap-3 border-l-2 border-transparent px-4 py-2 text-left transition-colors"
                  >
                    <div className="min-w-0 flex-1 font-mono text-xs">
                      <span className="text-muted-foreground">
                        {column.foreignKey.referencedTable}.
                      </span>
                      <span className="font-medium">{column.foreignKey.referencedColumn}</span>
                    </div>
                    <div className="text-muted-foreground group-hover:text-foreground shrink-0 text-xs whitespace-nowrap transition-colors">
                      go →
                    </div>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Reverse FK References Section */}
        {cellValue !== null && (
          <div>
            <button
              onClick={() => toggleSection("reverse-fk")}
              className="hover:bg-muted/50 flex w-full items-center justify-between px-4 py-3 transition-colors"
            >
              <div className="flex items-center gap-2">
                {expandedSections.has("reverse-fk") ? (
                  <ChevronDown className="text-muted-foreground h-4 w-4" />
                ) : (
                  <ChevronRight className="text-muted-foreground h-4 w-4" />
                )}
                <LinkIcon className="h-4 w-4 text-green-600 dark:text-green-400" />
                <span className="text-sm font-semibold">Referenced By</span>
                {!isLoadingReferences && (
                  <span className="text-muted-foreground text-xs">
                    (
                    {reverseReferences
                      ?.reduce(
                        (sum, ref) =>
                          Number(ref.matchingRowCount) === -1
                            ? sum
                            : sum + Number(ref.matchingRowCount ?? 0),
                        0,
                      )
                      .toLocaleString() ?? 0}
                    )
                  </span>
                )}
                {isLoadingReferences && <Spinner size="xs" colorPalette="muted" label="Loading" />}
              </div>
            </button>

            {expandedSections.has("reverse-fk") && (
              <div className="bg-muted/20 flex min-h-0 flex-1 flex-col px-0 pb-3">
                {isLoadingReferences && (
                  <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-12">
                    <div className="text-muted-foreground flex items-center gap-2 px-4 py-3 text-sm">
                      <Spinner size="sm" colorPalette="muted" label="Loading" />
                      Loading tables that reference this...
                    </div>
                  </div>
                )}
                {referencesError && (
                  <ErrorBoundaryCard
                    error={referencesError}
                    title="Failed to load relationships"
                    onRetry={() => refetchReferences()}
                  />
                )}{" "}
                {!isLoadingReferences && !reverseReferencesExist && (
                  <div className="text-muted-foreground px-4 py-3 text-sm">
                    No tables reference this value
                  </div>
                )}
                {!isLoadingReferences && reverseReferencesExist && (
                  <ListboxRoot collection={refList.collection} className="h-full">
                    <div className="space-y-2 px-4 py-2">
                      <div className="text-muted-foreground text-xs">
                        View rows with <code className="font-mono">{column.name}</code> ={" "}
                        <code className="text-foreground truncate font-mono">
                          {String(cellValue).slice(0, 150)}
                          {String(cellValue).length > 150 ? "..." : ""}
                        </code>
                      </div>
                      <div className="flex gap-2">
                        <ListboxMenuFilterContainer className="flex-1 p-0">
                          <ListboxMenuFilterInput
                            placeholder="Filter tables..."
                            className="h-7 rounded px-2 text-xs"
                            onChange={(e) => {
                              refList.filter(e.target.value);
                            }}
                          />
                        </ListboxMenuFilterContainer>
                        <Select
                          value={[sortBy]}
                          onValueChange={(details) =>
                            setSortBy(details.value[0] as "name" | "count")
                          }
                          collection={createListCollection({
                            items: [
                              { label: "A-Z", value: "name" },
                              { label: "Count", value: "count" },
                            ],
                          })}
                        >
                          <SelectControl className="h-7 w-24 rounded text-xs" size="sm">
                            <SelectTrigger>
                              <SelectValueText placeholder="Sort by" />
                            </SelectTrigger>
                          </SelectControl>
                          <SelectContent portalled={false}>
                            <SelectList>
                              {createListCollection({
                                items: [
                                  { label: "A-Z", value: "name" },
                                  { label: "Count", value: "count" },
                                ],
                              }).items.map((item) => (
                                <SelectItem key={item.value} item={item}>
                                  {item.label}
                                </SelectItem>
                              ))}
                            </SelectList>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <ListboxMenuList className="overflow-visible px-2">
                      {refList.collection.items.length > 0 ? (
                        refList.collection.items.map((item) => {
                          const ref = item.ref;
                          return (
                            <ListboxMenuItem
                              key={item.value}
                              item={item}
                              showIndicator={false}
                              className="hover:bg-muted/70 hover:border-foreground cursor-pointer border-l-2 border-transparent px-2 py-1.5 font-mono text-xs"
                              onClick={() => handleNavigateToReference(ref)}
                            >
                              <div className="flex w-full items-center justify-between gap-2">
                                <span>
                                  <span className="text-muted-foreground">{ref.table}.</span>
                                  <span className="font-medium">{ref.column}</span>
                                </span>
                                {ref.matchingRowCount !== undefined && (
                                  <span className="text-muted-foreground ml-auto text-xs whitespace-nowrap">
                                    ({ref.matchingRowCount.toLocaleString()})
                                  </span>
                                )}
                              </div>
                            </ListboxMenuItem>
                          );
                        })
                      ) : (
                        <div className="text-muted-foreground px-2 py-2 text-center text-xs">
                          No matching references
                        </div>
                      )}
                      <div className="pb-4" />
                    </ListboxMenuList>
                  </ListboxRoot>
                )}
              </div>
            )}
          </div>
        )}

        {/* No relationships state */}
        {cellValue !== null &&
          !forwardFKsExist &&
          !isLoadingReferences &&
          !reverseReferencesExist && (
            <div className="m-3 rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950">
              <div className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                <div className="text-sm text-blue-900 dark:text-blue-100">
                  This column has no foreign key relationships
                </div>
              </div>
            </div>
          )}
      </Stack>
    </div>
  );
}
