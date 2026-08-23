import { createListCollection } from "@ark-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { cx } from "class-variance-authority";
import { ChevronDown, ChevronUp, Star, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { useQueryLogger } from "#src/components/query-logger/use-query-logger.ts";
import { Badge } from "#src/components/ui/badge.tsx";
import {
  type QueryLogEntryType,
  QueryLogLevel,
  type QueryLogStatus,
  QueryLogType,
} from "#src/server/query-logger/query-logger.types.ts";
import { deleteQueryFavoriteServerFn } from "#src/server/query-logger/start-fns/delete-query-favorite.start.ts";
import { getQueryFavoritesQueryOptions } from "#src/server/query-logger/start-fns/get-query-favorites.start.ts";

import { Button, buttonVariants } from "../ui/button.tsx";
import { HStack } from "../ui/layout.tsx";
import * as Select from "../ui/select.tsx";
import { VirtualizerArea } from "../ui/virtualizer-area.tsx";
import { QueryLogEntry } from "./query-log-entry.tsx";
import { QueryLoggerDetailDialog } from "./query-logger-detail-dialog.tsx";

interface QueryLoggerContentProps {
  connectionUrl: string;
  connectionId?: string;
  isExpanded?: boolean;
  onCollapse?: () => void;
  onExpand?: () => void;
  /** Command palette (or similar) requests opening favorites or history. */
  paletteView?: "favorites" | "history" | null;
  onPaletteViewConsumed?: () => void;
}

export const QueryLoggerContent = ({
  connectionUrl,
  connectionId,
  isExpanded,
  onCollapse,
  onExpand,
  paletteView,
  onPaletteViewConsumed,
}: QueryLoggerContentProps) => {
  const queryClient = useQueryClient();
  const queryLogger = useQueryLogger({ connectionUrl });
  const [selectedEntry, setSelectedEntry] = useState<QueryLogEntryType | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showFavorites, setShowFavorites] = useState(false);

  useEffect(() => {
    if (!paletteView) return;
    setShowFavorites(paletteView === "favorites");
    if (!isExpanded) onExpand?.();
    onPaletteViewConsumed?.();
  }, [paletteView, isExpanded, onExpand, onPaletteViewConsumed]);

  const favoritesQuery = useQuery({
    ...getQueryFavoritesQueryOptions({ connectionId: connectionId ?? "" }),
    enabled: Boolean(connectionId) && showFavorites,
  });

  const deleteFavoriteMutation = useMutation({
    mutationFn: (id: string) => deleteQueryFavoriteServerFn({ data: { id } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["app", "queryFavorites"] });
    },
  });

  const handleExpand = (entry: QueryLogEntryType) => {
    setSelectedEntry(entry);
    setDialogOpen(true);
  };

  const toggleStatusFilter = (status: QueryLogStatus) => {
    queryLogger.setFilters({
      ...queryLogger.filters,
      status: queryLogger.filters?.status === status ? undefined : status,
    });
  };

  const isSuccessFiltered =
    queryLogger.filters?.status &&
    (Array.isArray(queryLogger.filters.status)
      ? queryLogger.filters.status.includes("success")
      : queryLogger.filters.status === "success");

  const isPendingFiltered =
    queryLogger.filters?.status &&
    (Array.isArray(queryLogger.filters.status)
      ? queryLogger.filters.status.includes("pending")
      : queryLogger.filters.status === "pending");

  const isErrorFiltered =
    queryLogger.filters?.status &&
    (Array.isArray(queryLogger.filters.status)
      ? queryLogger.filters.status.includes("error")
      : queryLogger.filters.status === "error");

  return (
    <>
      <div
        className="bg-muted/50 hover:bg-muted group flex h-12 shrink-0 items-center border-b px-4 py-2 transition-colors"
        data-testid="query-logger-panel"
      >
        <div className="flex items-center gap-2 font-medium">
          <span>Query Logger</span>
          {connectionId && (
            <Button
              variant={showFavorites ? "default" : "ghost"}
              size="sm"
              className="h-7 gap-1 px-2"
              data-testid="query-favorites-toggle"
              onClick={(e) => {
                e.stopPropagation();
                setShowFavorites((v) => !v);
                if (!isExpanded) onExpand?.();
              }}
            >
              <Star className="h-3.5 w-3.5" />
              <Badge colorPalette="muted" size="2xs">
                Favorites
              </Badge>
            </Button>
          )}
          {isExpanded !== undefined && (onCollapse || onExpand) && (
            <button
              className="hover:bg-primary/20 ml-2 rounded p-1 opacity-60 transition-colors hover:opacity-100"
              title={isExpanded ? "Collapse" : "Expand"}
              aria-label={isExpanded ? "Collapse query logger" : "Expand query logger"}
              data-testid="toggle-query-logger"
              onClick={(e) => {
                e.stopPropagation();
                if (isExpanded) {
                  onCollapse?.();
                } else {
                  onExpand?.();
                }
              }}
            >
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
            </button>
          )}
        </div>
        <HStack className="mr-auto ml-2 gap-1">
          <button
            type="button"
            onClick={() => {
              toggleStatusFilter("success");
              if (!isExpanded) {
                onExpand?.();
              }
            }}
            title="Filter by success"
            aria-label={`Filter successful queries (${queryLogger.counts.success})`}
            aria-pressed={Boolean(isSuccessFiltered)}
            className={cx(
              buttonVariants({ size: "sm", variant: "ghost" }),
              "flex items-center gap-1.5 rounded-md px-2 py-1.5 transition-all",
              isSuccessFiltered
                ? "bg-green-500/20 text-green-700 hover:bg-green-500/30"
                : "text-muted-foreground hover:text-foreground hover:bg-green-200/50",
            )}
          >
            <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
            <span className="hidden text-xs font-medium xl:inline">Success</span>
            <span className="text-xs font-medium">{queryLogger.counts.success}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              toggleStatusFilter("pending");
              if (!isExpanded) {
                onExpand?.();
              }
            }}
            title="Filter by pending"
            aria-label={`Filter pending queries (${queryLogger.counts.pending})`}
            aria-pressed={Boolean(isPendingFiltered)}
            className={cx(
              buttonVariants({ size: "sm", variant: "ghost" }),
              "flex items-center gap-1.5 rounded-md px-2 py-1.5 transition-all",
              isPendingFiltered
                ? "bg-amber-500/20 text-amber-700 hover:bg-amber-500/30"
                : "text-muted-foreground hover:text-foreground hover:bg-amber-200/50",
            )}
          >
            <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            <span className="hidden text-xs font-medium xl:inline">Pending</span>
            <span className="text-xs font-medium">{queryLogger.counts.pending}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              toggleStatusFilter("error");
              if (!isExpanded) {
                onExpand?.();
              }
            }}
            title="Filter by error"
            aria-label={`Filter failed queries (${queryLogger.counts.error})`}
            aria-pressed={Boolean(isErrorFiltered)}
            className={cx(
              buttonVariants({ size: "sm", variant: "ghost" }),
              "flex items-center gap-1.5 rounded-md px-2 py-1.5 transition-all",
              isErrorFiltered
                ? "bg-red-500/20 text-red-700 hover:bg-red-500/30"
                : "text-muted-foreground hover:text-foreground hover:bg-red-200/50",
            )}
          >
            <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
            <span className="hidden text-xs font-medium xl:inline">Failed</span>
            <span className="text-xs font-medium">{queryLogger.counts.error}</span>
          </button>
        </HStack>
        <HStack align="center">
          <Select.SelectRoot
            className="w-full min-w-64"
            collection={logTypeCollection}
            positioning={{ sameWidth: true }}
            multiple
            defaultValue={
              queryLogger.filters?.type
                ? Array.isArray(queryLogger.filters.type)
                  ? (queryLogger.filters.type as any[])
                  : ([queryLogger.filters.type] as any[])
                : undefined
            }
            onValueChange={(details) => {
              queryLogger.setFilters((prev) => ({
                ...prev,
                type: details.value as any[],
              }));
            }}
          >
            <Select.SelectControl size="sm">
              <Select.SelectTrigger>
                <Select.SelectValueText placeholder="Type: All" />
                <Select.SelectIndicator />
              </Select.SelectTrigger>
            </Select.SelectControl>
            <Select.SelectContent>
              {logTypeCollection.items.map((item) => (
                <Select.SelectItem key={item.value} item={item}>
                  {item.label}
                </Select.SelectItem>
              ))}
            </Select.SelectContent>
          </Select.SelectRoot>
          <Select.SelectRoot
            className="w-full min-w-48"
            collection={logLevelCollection}
            positioning={{ sameWidth: true }}
            multiple
            defaultValue={
              queryLogger.filters?.level
                ? Array.isArray(queryLogger.filters.level)
                  ? (queryLogger.filters.level as any[])
                  : ([queryLogger.filters.level] as any[])
                : undefined
            }
            onValueChange={(details) => {
              queryLogger.setFilters((prev) => ({
                ...prev,
                level: details.value as any[],
              }));
            }}
          >
            <Select.SelectControl size="sm">
              <Select.SelectTrigger>
                <Select.SelectValueText placeholder="Log level: All" />
                <Select.SelectIndicator />
              </Select.SelectTrigger>
            </Select.SelectControl>
            <Select.SelectContent>
              {logLevelCollection.items.map((item) => (
                <Select.SelectItem key={item.value} item={item}>
                  {item.label}
                </Select.SelectItem>
              ))}
            </Select.SelectContent>
          </Select.SelectRoot>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              queryLogger.clearHistory();
            }}
            disabled={queryLogger.isClearing}
            title="Clear history"
            aria-label="Clear query history"
            className="text-muted-foreground hover:text-foreground"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </HStack>
      </div>

      <div className="flex h-full min-h-0 flex-1 flex-col">
        {showFavorites ? (
          <div className="flex h-full min-h-0 flex-1 flex-col divide-y overflow-auto">
            {(favoritesQuery.data?.length ?? 0) === 0 ? (
              <div className="text-muted-foreground flex h-52 items-center justify-center text-sm">
                No saved favorites yet — use the star in the SQL bar
              </div>
            ) : (
              favoritesQuery.data?.map((fav) => (
                <div
                  key={fav.id}
                  className="hover:bg-muted/50 flex items-start gap-2 px-3 py-2"
                  data-testid="query-favorite-row"
                >
                  <Star className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge colorPalette="warning" size="2xs">
                        Favorite
                      </Badge>
                      <p className="truncate text-xs font-medium">{fav.label}</p>
                    </div>
                    <p className="text-muted-foreground truncate font-mono text-xs">{fav.sql}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 shrink-0 p-0"
                    title="Delete favorite"
                    onClick={() => deleteFavoriteMutation.mutate(fav.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>
        ) : queryLogger.history.length === 0 ? (
          <div className="text-muted-foreground flex h-52 items-center justify-center">
            No queries executed yet
          </div>
        ) : (
          <div className="flex h-full min-h-0 flex-1 flex-col divide-y">
            <VirtualizerArea
              count={queryLogger.history.length}
              virtualizerOptions={{ estimateSize: () => 50 }}
            >
              {({ virtualItems, totalSize, paddingTop, paddingBottom }) => (
                <>
                  <div style={{ height: `${totalSize}px` }} className="relative">
                    {/* Padding for virtualizer */}
                    {paddingTop > 0 && <div style={{ height: `${paddingTop}px` }} />}

                    {virtualItems.toReversed().map((virtualItem) => {
                      const entry = queryLogger.history[virtualItem.index];
                      if (!entry) return null;

                      return <QueryLogEntry key={entry.id} entry={entry} onExpand={handleExpand} />;
                    })}

                    {/* Padding for virtualizer */}
                    {paddingBottom > 0 && <div style={{ height: `${paddingBottom}px` }} />}
                  </div>
                </>
              )}
            </VirtualizerArea>
          </div>
        )}
      </div>

      <QueryLoggerDetailDialog
        key={selectedEntry?.id}
        entry={selectedEntry}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        connectionUrl={connectionUrl}
      />
    </>
  );
};

const logTypeCollection = createListCollection({
  items: Object.entries(QueryLogType)
    .filter(([key]) => isNaN(Number(key)))
    .map(([label, value]) => ({
      label: label,
      value: value as QueryLogType,
    })),
});

const logLevelCollection = createListCollection({
  items: Object.entries(QueryLogLevel)
    .filter(([key]) => isNaN(Number(key)))
    .map(([label, value]) => ({
      label: label,
      value: value as QueryLogLevel,
    })),
});
