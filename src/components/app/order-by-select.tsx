import { useListCollection } from "@ark-ui/react";
import { Listbox } from "@ark-ui/react/listbox";
import { useFilter } from "@ark-ui/react/locale";
import { Popover } from "@ark-ui/react/popover";
import { Portal } from "@ark-ui/react/portal";
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowDownUp,
  ArrowUp,
  ArrowUpToLine,
  ChevronsUpDown,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "../ui/button";

export interface OrderBySelectProps {
  /**
   * List of available column names to sort by
   */
  columnList: string[];
  /**
   * Current sort column
   */
  orderBy?: string;
  /**
   * Current sort direction
   */
  orderDirection?: "asc" | "desc";
  /**
   * Current nulls order
   */
  nullsOrder?: "first" | "last";
  /**
   * Callback when sort changes
   */
  onOrderChange: (orderBy: string | undefined, orderDirection?: "asc" | "desc") => void;
  /**
   * Callback when nulls order changes
   */
  onNullsOrderChange?: (nullsOrder: "first" | "last" | undefined) => void;
  /**
   * Get display label for column (default: use column name)
   */
  getColumnLabel?: (columnName: string) => string;
  /**
   * Minimal styling variant
   */
  minimal?: boolean;
}

export function OrderBySelect(props: OrderBySelectProps) {
  const {
    columnList,
    orderBy,
    orderDirection = "asc",
    nullsOrder,
    onOrderChange,
    onNullsOrderChange,
    getColumnLabel,
    minimal = false,
  } = props;
  const [open, setOpen] = useState(false);

  const allColumns = useMemo(
    () =>
      columnList.map((col) => ({
        label: getColumnLabel?.(col) || col,
        value: col,
      })),
    [columnList, getColumnLabel],
  );

  const filters = useFilter({ sensitivity: "base" });
  const list = useListCollection({
    initialItems: allColumns,
    filter: filters.contains,
  });

  useEffect(() => {
    list.set(allColumns);
  }, [allColumns, list.set]);

  const buttonClassName = minimal ? "h-8 px-2 gap-1 justify-between" : "w-48 h-9 justify-between";

  const containerClassName = minimal
    ? "flex items-center gap-2"
    : "px-4 py-2 border-b bg-muted/30 flex items-center gap-2";

  const sortIcon =
    orderDirection === "desc" ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />;

  return (
    <div className={containerClassName}>
      <Popover.Root open={open} onOpenChange={(e) => setOpen(e.open)}>
        <Popover.Trigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={buttonClassName}
            data-testid="order-by-button"
          >
            <span className="text-foreground flex items-center gap-1 text-xs font-medium tracking-wide uppercase">
              {orderBy ? null : <ArrowDownUp />}
              Sort
              {orderBy && (
                <>
                  <span className="text-foreground/70 font-normal">
                    {getColumnLabel?.(orderBy) || orderBy}
                  </span>
                  {sortIcon}
                </>
              )}
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
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 flex-1 text-xs"
                      onClick={() => {
                        onOrderChange(undefined);
                        setOpen(false);
                      }}
                    >
                      Clear Sort
                    </Button>
                    <div
                      title={
                        orderBy
                          ? `Sort ${orderDirection === "asc" ? "descending" : "ascending"}`
                          : ""
                      }
                    >
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2"
                        onClick={() => {
                          if (orderBy) {
                            onOrderChange(orderBy, orderDirection === "asc" ? "desc" : "asc");
                          }
                        }}
                        disabled={!orderBy}
                      >
                        {orderDirection === "desc" ? (
                          <ArrowDown className="h-4 w-4" />
                        ) : (
                          <ArrowUp className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  {orderBy && onNullsOrderChange && (
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant={nullsOrder === "first" ? "default" : "outline"}
                        className="h-7 flex-1 text-xs"
                        onClick={() => {
                          onNullsOrderChange(nullsOrder === "first" ? undefined : "first");
                        }}
                      >
                        <ArrowUpToLine className="mr-1 h-3 w-3" />
                        Nulls first
                      </Button>
                      <Button
                        size="sm"
                        variant={nullsOrder === "last" ? "default" : "outline"}
                        className="h-7 flex-1 text-xs"
                        onClick={() => {
                          onNullsOrderChange(nullsOrder === "last" ? undefined : "last");
                        }}
                      >
                        <ArrowDownToLine className="mr-1 h-3 w-3" />
                        Nulls last
                      </Button>
                    </div>
                  )}
                  <input
                    placeholder="Filter columns..."
                    className="border-input placeholder:text-muted-foreground focus-visible:ring-ring flex h-8 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:ring-1 focus-visible:outline-none"
                    autoFocus
                    onChange={(e) => {
                      list.filter(e.target.value);
                    }}
                  />
                </div>
                <Listbox.Content className="max-h-64 overflow-y-auto">
                  {list.collection.items.length > 0 ? (
                    <Listbox.ItemGroup>
                      {list.collection.items.map((item) => {
                        const isSelected = orderBy === item.value;

                        return (
                          <Listbox.Item
                            key={item.value}
                            item={item}
                            className="hover:bg-muted data-highlighted:bg-accent flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors"
                            onClick={(e: React.MouseEvent<HTMLDivElement>) => {
                              e.preventDefault();
                              e.stopPropagation();
                              // Cycle through: none -> asc -> desc -> none
                              if (isSelected) {
                                // Same column: cycle through asc -> desc -> none
                                if (orderDirection === "asc") {
                                  onOrderChange(item.value, "desc");
                                } else {
                                  // desc -> reset
                                  onOrderChange(undefined);
                                }
                              } else {
                                // Different column: start with asc
                                onOrderChange(item.value, "asc");
                              }
                              setOpen(false);
                            }}
                          >
                            {isSelected ? (
                              <div className="flex h-4 w-4 items-center justify-center">
                                {sortIcon}
                              </div>
                            ) : (
                              <div className="h-4 w-4" />
                            )}
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
