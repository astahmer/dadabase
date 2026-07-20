import { Filter, Search, X } from "lucide-react";

import { cn } from "../../lib/utils.ts";
import { Button } from "../ui/button.tsx";
import { inputVariants } from "../ui/input.tsx";
import { Kbd } from "../ui/kbd.tsx";

export interface TableFindBarProps {
  open: boolean;
  query: string;
  filterMode: boolean;
  matchCount: number;
  onQueryChange: (query: string) => void;
  onFilterModeChange: (filterMode: boolean) => void;
  onClose: () => void;
  className?: string;
}

export function TableFindBar(props: TableFindBarProps) {
  const {
    open,
    query,
    filterMode,
    matchCount,
    onQueryChange,
    onFilterModeChange,
    onClose,
    className,
  } = props;

  if (!open) return null;

  return (
    <div
      className={cn(
        "bg-background/95 absolute top-2 right-2 z-20 flex items-center gap-1.5 rounded-md border px-2 py-1.5 shadow-md backdrop-blur",
        className,
      )}
      data-testid="table-find-bar"
      role="search"
    >
      <Search className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
      <input
        className={cn(inputVariants({ size: "sm" }), "h-7 w-44 text-xs")}
        placeholder="Find in rows…"
        value={query}
        autoFocus
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onClose();
          }
        }}
        data-testid="table-find-input"
      />
      <span className="text-muted-foreground min-w-10 text-xs tabular-nums">
        {query.trim() ? `${matchCount}` : ""}
      </span>
      <Button
        type="button"
        variant={filterMode ? "default" : "ghost"}
        size="xs"
        withIcon={false}
        className="h-7 gap-1 px-1.5"
        title={filterMode ? "Showing matching rows only" : "Highlight matches (click to filter)"}
        onClick={() => onFilterModeChange(!filterMode)}
        data-testid="table-find-filter-toggle"
      >
        <Filter className="h-3 w-3" />
        {filterMode ? "Filter" : "Highlight"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        withIcon={false}
        className="h-7 w-7 p-0"
        onClick={onClose}
        title="Close (Esc)"
        data-testid="table-find-close"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
      <Kbd className="ml-0.5 hidden sm:inline-flex">Esc</Kbd>
    </div>
  );
}
