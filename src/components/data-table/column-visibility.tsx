import type { Table as TanstackTable } from "@tanstack/react-table";

import { useListCollection } from "@ark-ui/react";
import { Listbox } from "@ark-ui/react/listbox";
import { useFilter } from "@ark-ui/react/locale";
import { Popover } from "@ark-ui/react/popover";
import { Portal } from "@ark-ui/react/portal";
import { ChevronsUpDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "../ui/button";

export interface ColumnVisibilityControlsProps<TData> {
  table: TanstackTable<TData>;
  columnList: string[];
  minimal?: boolean;
  visibilityMode?: "client" | "server";
  onVisibilityModeChange?: (mode: "client" | "server") => void;
}

export function ColumnVisibilityControls<TData>(props: ColumnVisibilityControlsProps<TData>) {
  const { table, minimal = false, visibilityMode = "client", onVisibilityModeChange } = props;
  const [open, setOpen] = useState(false);

  const allColumns = useMemo(
    () =>
      props.columnList.map((col) => {
        return { label: col, value: col };
      }),
    [props.columnList],
  );

  // https://github.com/TanStack/table/discussions/5505 / https://github.com/TanStack/table/pull/5964
  // const getColumn = (columnId: string) => table._getAllFlatColumnsById()[columnId];

  const visibleColumns = table
    .getVisibleLeafColumns()
    .filter((col) => col.id !== "__select" && col.id !== "__expand" && col.id !== "__actions");
  const allVisible = visibleColumns.length === allColumns.length;

  const leafColumns = table.getAllLeafColumns();
  const handleSelectAll = () => {
    if (allVisible) {
      table.setColumnVisibility((_current) =>
        Object.fromEntries(
          leafColumns.map((col) => [
            col.id,
            col.id === "__select" || col.id === "__expand" || col.id === "__actions",
          ]),
        ),
      );
    } else {
      table.setColumnVisibility((_current) =>
        Object.fromEntries(leafColumns.map((col) => [col.id, true])),
      );
    }
  };

  const filters = useFilter({ sensitivity: "base" });
  const list = useListCollection({
    initialItems: allColumns,
    filter: filters.contains,
  });
  useEffect(() => {
    list.set(allColumns);
  }, [allColumns, list.set]);

  const buttonClassName = minimal
    ? "h-8 shrink-0 gap-1 px-2 justify-between"
    : "w-48 h-9 justify-between";

  const containerClassName = minimal
    ? "flex shrink-0 items-center gap-2"
    : "px-4 py-2 border-b bg-muted/30 flex items-center gap-2";

  return (
    <div className={containerClassName}>
      <Popover.Root
        open={open}
        onOpenChange={(e) => setOpen(e.open)}
        initialFocusEl={() => document.getElementById("column-visibility-filter")}
      >
        <Popover.Trigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={buttonClassName}
            data-testid="column-visibility-button"
          >
            <span className="text-foreground text-xs font-medium tracking-wide uppercase">
              {minimal ? "Columns" : "📋 Visible Columns"}{" "}
              {allVisible ? "" : `(${visibleColumns.length}/${allColumns.length})`}
            </span>
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </Button>
        </Popover.Trigger>
        <Portal>
          <Popover.Positioner>
            <Popover.Content className="bg-card border-border z-50 rounded-md border shadow-lg">
              <Listbox.Root collection={list.collection}>
                <div className="border-border space-y-2 border-b p-2">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs font-medium">Mode:</span>
                    <div className="flex flex-1 gap-1">
                      <Button
                        size="sm"
                        variant={visibilityMode === "client" ? "default" : "outline"}
                        className="h-6 flex-1 px-2 text-xs"
                        onClick={() => onVisibilityModeChange?.("client")}
                      >
                        Client
                      </Button>
                      <Button
                        size="sm"
                        variant={visibilityMode === "server" ? "default" : "outline"}
                        className="h-6 flex-1 px-2 text-xs"
                        onClick={() => onVisibilityModeChange?.("server")}
                      >
                        Server
                      </Button>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 w-full text-xs"
                    onClick={handleSelectAll}
                  >
                    {allVisible ? "Unselect All" : "Select All"}
                  </Button>
                  <Listbox.Context>
                    {(ctx) => (
                      <Listbox.Input
                        id="column-visibility-filter"
                        placeholder="Filter columns..."
                        className="border-input placeholder:text-muted-foreground focus-visible:ring-ring flex h-8 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:ring-1 focus-visible:outline-none"
                        autoFocus
                        onChange={(e) => {
                          list.filter(e.target.value);
                        }}
                        onKeyDown={(e) => {
                          const highlightedItem = ctx.highlightedItem as {
                            value: string;
                          };
                          if (e.key === "Enter" && highlightedItem) {
                            const column = leafColumns.find(
                              (col) => col.id === highlightedItem.value,
                            );
                            if (!column) {
                              console.warn(
                                `Could not find column with id ${highlightedItem.value}`,
                                leafColumns,
                              );
                              return;
                            }

                            column?.toggleVisibility?.();
                          }
                        }}
                      />
                    )}
                  </Listbox.Context>
                </div>
                <Listbox.Content className="max-h-64 overflow-y-auto">
                  {list.collection.items.length > 0 ? (
                    <Listbox.ItemGroup>
                      {list.collection.items.map((item) => {
                        const column = leafColumns.find((col) => col.id === item.value);
                        if (!column) {
                          // console.warn(
                          // 	`Could not find column with id ${item.value}`,
                          // 	leafColumns,
                          // );
                          return;
                        }
                        const isVisible = column?.getIsVisible?.() ?? true;

                        return (
                          <Listbox.Item
                            key={item.value}
                            item={item}
                            className="hover:bg-muted data-highlighted:bg-accent flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              column?.toggleVisibility?.();
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isVisible}
                              readOnly
                              className="rounded"
                            />
                            <Listbox.ItemText className="flex-1">{item.label}</Listbox.ItemText>
                          </Listbox.Item>
                        );
                      })}
                    </Listbox.ItemGroup>
                  ) : (
                    <div className="text-muted-foreground px-2 py-2 text-center text-xs">
                      No columns found
                    </div>
                  )}
                </Listbox.Content>
              </Listbox.Root>
            </Popover.Content>
          </Popover.Positioner>
        </Portal>
      </Popover.Root>
    </div>
  );
}
