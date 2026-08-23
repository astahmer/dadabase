import { createListCollection, useFilter } from "@ark-ui/react";
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "#src/components/ui/button.tsx";
import { HStack, Stack } from "#src/components/ui/layout.tsx";
import {
  ListboxMenuFilterInput,
  ListboxMenuItem,
  ListboxMenuList,
  ListboxRoot,
} from "#src/components/ui/listbox-menu.tsx";
import { Spinner } from "#src/components/ui/spinner.tsx";
import { toaster } from "#src/components/ui/toaster.tsx";
import { DatabaseDialect } from "#src/db/dialect.ts";
import { buildJoinSqlPreview } from "#src/server/introspection/join-builder.ts";
import { listAvailableSchemasQueryOptions } from "#src/server/introspection/start-fns/get-available-schemas.start.ts";
import { listAvailableTablesQueryOptions } from "#src/server/introspection/start-fns/get-available-tables.start.ts";
import { getTableRelationshipsQueryOptions } from "#src/server/introspection/start-fns/get-table-relationships.start.ts";

import type { TableRelationship } from "../relationships/relationships.ts";
import type { JoinTablesConfig } from "./join-tables.types";

import { TableName } from "../table-name.tsx";
import { cascadeRemoveJoins } from "./cascade-remove-joins.ts";
import { getTransitiveJoinRelationships } from "./get-transitive-join-relationships.ts";
import { SortableJoinedTableRow } from "./sortable-joined-table-row.tsx";
import { useJoinTablesState } from "./use-join-tables-state.ts";
import { useJoinedTables } from "./use-joined-tables.ts";

interface JoinTablesPanelProps {
  onClose: () => void;
  url: string;
  schema: string;
  table: string;
  onChange: (config: JoinTablesConfig) => void;
  initialConfig?: JoinTablesConfig;
}

export const JoinTablesPanel = (props: JoinTablesPanelProps) => {
  const { onClose, url, schema, table, onChange, initialConfig } = props;
  const joinState = useJoinTablesState(table, initialConfig);
  const hasMounted = useRef(false);

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }
    onChange(joinState.config);
  }, [joinState.config, onChange]);

  const relationshipsQuery = useQuery(
    getTableRelationshipsQueryOptions({
      url,
      schema,
      table,
    }),
  );

  const joinedRelationshipsQueries = useQueries({
    queries: joinState.config.joins.map((j) =>
      getTableRelationshipsQueryOptions({
        url,
        schema: j.schema,
        table: j.table,
      }),
    ),
  });

  const columnQueries = useJoinedTables({
    url: url,
    joins: joinState.config.joins,
  });

  const relationshipsBySource = useMemo(() => {
    const map = new Map<string, TableRelationship[]>();
    if (relationshipsQuery.data) {
      map.set(`${schema}.${table}`, relationshipsQuery.data);
    }
    for (let i = 0; i < joinState.config.joins.length; i++) {
      const joined = joinState.config.joins[i];
      const q = joinedRelationshipsQueries[i];
      if (q?.data) {
        map.set(`${joined.schema}.${joined.table}`, q.data);
      }
    }
    return map;
  }, [relationshipsQuery.data, schema, table, joinState.config.joins, joinedRelationshipsQueries]);

  const unselectedRelationships = useMemo(() => {
    return getTransitiveJoinRelationships({
      base: { schema, table },
      joined: joinState.config.joins.map((j) => ({
        schema: j.schema,
        table: j.table,
      })),
      relationshipsBySource,
    });
  }, [relationshipsBySource, schema, table, joinState.config.joins]);

  const filters = useFilter({ sensitivity: "base" });
  const [searchInput, setSearchInput] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = joinState.config.joins.findIndex(
        (j) => `${j.schema}.${j.table}` === active.id,
      );
      const newIndex = joinState.config.joins.findIndex(
        (j) => `${j.schema}.${j.table}` === over.id,
      );
      if (oldIndex !== -1 && newIndex !== -1) {
        joinState.reorder(oldIndex, newIndex);
      }
    }
  };

  const tableCollection = createListCollection({
    items: unselectedRelationships.map((item) => {
      const rel = item.relationship;
      const targetSchema = rel.type === "outgoing" ? rel.referencedSchema : rel.referencingSchema;
      const targetTable = rel.type === "outgoing" ? rel.referencedTable : rel.referencingTable;
      return {
        label: `${targetSchema}.${targetTable}`,
        value: `${item.sourceSchema}.${item.sourceTable}|${rel.type}|${rel.constraintName}|${rel.referencingSchema}.${rel.referencingTable}.${rel.referencingColumn}|${rel.referencedSchema}.${rel.referencedTable}.${rel.referencedColumn}`,
        rel,
        sourceSchema: item.sourceSchema,
        sourceTable: item.sourceTable,
        type: rel.type,
      };
    }),
    groupBy: (item) => item.type,
  });

  const handleRemoveJoin = (table: string, schema: string) => {
    const { removedCount } = cascadeRemoveJoins({
      joins: joinState.config.joins,
      remove: { schema, table },
    });
    const dependentRemovedCount = Math.max(0, removedCount - 1);

    joinState.remove(table, schema);

    if (dependentRemovedCount > 0) {
      toaster.create({
        title: "Dependent joins removed",
        description: `Also removed ${dependentRemovedCount} dependent join${dependentRemovedCount === 1 ? "" : "s"}.`,
      });
    }
  };

  const handleClearJoins = () => {
    joinState.clear();
  };

  const isLoadingRelationships = relationshipsQuery.isLoading && !relationshipsQuery.data;

  const schemaListQuery = useQuery({
    ...listAvailableSchemasQueryOptions({ url: url }),
    retry: 3,
  });
  const schemaList = schemaListQuery.data || [];

  const tablesListQuery = useQuery({
    ...listAvailableTablesQueryOptions({ url: url }),
    retry: 3,
  });
  const tableList = tablesListQuery.data || [];

  const schemaWithTables = schemaList.filter((schema) =>
    tableList.some((t) => t.schema === schema),
  );
  const hasMultipleSchemas = schemaWithTables.length > 1;

  const [inputKey, setInputKey] = useState(0);

  return (
    <section aria-label="Join workspace" className="bg-background border-t">
      <header className="flex items-center justify-between gap-4 border-b px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">Join tables</h2>
          <p className="text-muted-foreground text-xs">
            Add related tables to{" "}
            <span className="font-mono font-medium">
              <TableName schema={schema} table={table} hasMultipleSchemas={hasMultipleSchemas} />
            </span>
            . Changes update this view immediately.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {joinState.config.joins.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearJoins}
              className="text-muted-foreground h-7 px-2 text-xs"
            >
              Clear joins
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onClose} className="h-7 px-2 text-xs">
            Close
          </Button>
        </div>
      </header>

      <div className="grid max-h-[min(42rem,calc(100vh-12rem))] min-h-[22rem] lg:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.28fr)]">
        <aside className="border-b p-4 lg:border-r lg:border-b-0">
          {/* Joinable table selector */}
          {isLoadingRelationships ? (
            <div className="flex items-center justify-center py-4">
              <Spinner className="h-5 w-5" />
            </div>
          ) : unselectedRelationships.length === 0 ? (
            <div className="text-muted-foreground rounded border border-dashed p-3 text-sm">
              No relationships found for this table
            </div>
          ) : (
            <div className="space-y-2">
              <div>
                <div className="text-sm font-medium">Related tables</div>
                <p className="text-muted-foreground text-xs">
                  Choose a foreign-key relationship to extend this result.
                </p>
              </div>
              <ListboxRoot collection={tableCollection} selectionMode="none">
                <ListboxMenuFilterInput
                  key={inputKey}
                  placeholder="Search tables..."
                  onChange={(e) => {
                    setSearchInput(e.target.value);
                  }}
                />
                <ListboxMenuList className="max-h-40">
                  {tableCollection.group().map(([type, group]) => {
                    const filteredGroup = group.filter((item) =>
                      filters.contains(item.value, searchInput),
                    );

                    if (filteredGroup.length === 0) return null;

                    const typeLabel =
                      type === "outgoing"
                        ? `Outgoing: Foreign keys (${filteredGroup.length})`
                        : `Incoming: Referenced by (${filteredGroup.length})`;

                    return (
                      <div key={type}>
                        <div className="text-muted-foreground bg-muted/30 px-3 py-2 text-xs font-medium">
                          {typeLabel}
                        </div>
                        {filteredGroup.map((item) => {
                          const rel = item.rel;
                          const targetTable =
                            rel.type === "outgoing" ? rel.referencedTable : rel.referencingTable;
                          const targetSchema =
                            rel.type === "outgoing" ? rel.referencedSchema : rel.referencingSchema;
                          const firstLabel =
                            rel.type === "outgoing"
                              ? `${rel.referencingTable}.${rel.referencingColumn}`
                              : `${rel.referencingTable}.${rel.referencingColumn}`;
                          const secondLabel =
                            rel.type === "outgoing"
                              ? `${rel.referencedTable}.${rel.referencedColumn}`
                              : `${rel.referencedTable}.${rel.referencedColumn}`;

                          return (
                            <ListboxMenuItem
                              key={item.value}
                              item={item.value}
                              onClick={() => {
                                const sourceSchema = item.sourceSchema;
                                const sourceTable = item.sourceTable;
                                const referencingCol =
                                  rel.type === "outgoing"
                                    ? rel.referencingColumn
                                    : rel.referencedColumn;
                                const referencedCol =
                                  rel.type === "outgoing"
                                    ? rel.referencedColumn
                                    : rel.referencingColumn;

                                joinState.add({
                                  schema: targetSchema,
                                  table: targetTable,
                                  joinFrom: {
                                    schema: sourceSchema,
                                    table: sourceTable,
                                  },
                                  type: "left",
                                  columns: "all",
                                  joinCondition: {
                                    mode: "standard",
                                    referencingColumn: referencingCol,
                                    referencedColumn: referencedCol,
                                  },
                                });
                                setInputKey(inputKey + 1);
                              }}
                            >
                              <HStack
                                className="min-w-0 flex-1"
                                align="center"
                                title={`${firstLabel} › ${secondLabel}`}
                              >
                                <div className="truncate font-medium">{firstLabel}</div>
                                <div className="text-muted-foreground shrink-0">›</div>
                                <div className="text-muted-foreground truncate text-xs">
                                  {secondLabel}
                                </div>
                              </HStack>
                            </ListboxMenuItem>
                          );
                        })}
                      </div>
                    );
                  })}
                </ListboxMenuList>
              </ListboxRoot>
            </div>
          )}
        </aside>
        <div className="min-w-0 overflow-y-auto p-4">
          <Stack gap="4">
            {joinState.config.joins.length === 0 && (
              <div className="border-border/70 bg-muted/20 text-muted-foreground rounded-md border border-dashed p-4 text-sm">
                Select a relationship to add it to the join plan. You can refine its type, columns,
                and condition here.
              </div>
            )}
            {/* Joined tables list */}
            {joinState.config.joins.length > 0 && (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <Stack gap="3">
                  <div className="text-sm font-medium">
                    Join plan ({joinState.config.joins.length})
                  </div>
                  <SortableContext
                    items={joinState.config.joins.map((j) => `${j.schema}.${j.table}`)}
                    strategy={verticalListSortingStrategy}
                  >
                    {joinState.config.joins.map((join, index) => {
                      const columnsQuery = columnQueries[index];
                      const columns = columnsQuery.data || [];

                      if (columnsQuery.isLoading) {
                        return (
                          <Stack key={index}>
                            <Spinner className="h-4 w-4" />
                          </Stack>
                        );
                      }

                      return (
                        <SortableJoinedTableRow
                          key={`${join.schema}.${join.table}.${join.type}.${index}`}
                          joined={join}
                          availableColumns={columns}
                          parentSchema={schema}
                          parentTable={table}
                          index={index}
                          onUpdateType={(type) =>
                            joinState.update(join.table, join.schema, { type })
                          }
                          onUpdateColumns={(cols) =>
                            joinState.update(join.table, join.schema, {
                              columns: cols,
                            })
                          }
                          onUpdateFilters={(filters) =>
                            joinState.update(join.table, join.schema, {
                              filters,
                            })
                          }
                          onUpdateJoinConditionMode={(mode) =>
                            joinState.updateJoinConditionMode(join.table, join.schema, mode)
                          }
                          onUpdateCustomJoinConditions={(conditions) =>
                            joinState.updateCustomJoinConditions(
                              join.table,
                              join.schema,
                              conditions,
                            )
                          }
                          onUpdateJoinCondition={(updates) =>
                            joinState.update(join.table, join.schema, updates)
                          }
                          onRemove={() => handleRemoveJoin(join.table, join.schema)}
                        />
                      );
                    })}
                  </SortableContext>
                </Stack>
              </DndContext>
            )}
            {/* SQL preview */}
            {joinState.config.joins.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Generated SQL:</div>
                <div className="max-h-40 overflow-x-auto overflow-y-auto rounded bg-slate-900 p-3 font-mono text-xs break-words whitespace-pre-wrap text-slate-100">
                  {/* TODO use getQueryAsSql */}
                  {buildJoinSqlPreview(
                    schema,
                    table,
                    joinState.config.joins,
                    DatabaseDialect.Postgres, // TODO
                  )}
                </div>
              </div>
            )}
            {/* Result preview */}
            {joinState.config.joins.length > 0 && (
              <div className="bg-muted space-y-2 rounded p-3 text-xs">
                <div className="text-muted-foreground font-medium">Result columns:</div>
                <div className="max-h-24 space-y-1 overflow-y-auto">
                  {/* Original table columns */}
                  <div>
                    <span className="text-muted-foreground">
                      •{" "}
                      <TableName
                        schema={schema}
                        table={table}
                        hasMultipleSchemas={hasMultipleSchemas}
                      />
                      .*
                    </span>
                  </div>
                  {/* Joined table columns */}
                  {joinState.config.joins.map((join) => (
                    <div key={`${join.schema}.${join.table}`}>
                      <span className="text-muted-foreground">
                        •{" "}
                        <TableName
                          schema={join.schema}
                          table={join.table}
                          hasMultipleSchemas={hasMultipleSchemas}
                        />
                        {join.columns === "all" ? ".*" : ` (${join.columns.length} cols)`}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Stack>
        </div>
      </div>
    </section>
  );
};
