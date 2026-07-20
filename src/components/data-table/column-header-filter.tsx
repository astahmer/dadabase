import { Filter, X } from "lucide-react";
import { useEffect, useState } from "react";

import type { ColumnHeaderFilterOperator } from "./upsert-column-header-filter.ts";

import { cn } from "../../lib/utils.ts";
import { Button } from "../ui/button.tsx";
import { inputVariants } from "../ui/input.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover.tsx";

export interface ColumnHeaderFilterProps {
  columnId: string;
  active?: { operator: ColumnHeaderFilterOperator; value: string };
  onApply: (filter: { operator: ColumnHeaderFilterOperator; value: string } | null) => void;
}

export function ColumnHeaderFilter(props: ColumnHeaderFilterProps) {
  const { columnId, active, onApply } = props;
  const [open, setOpen] = useState(false);
  const [operator, setOperator] = useState<ColumnHeaderFilterOperator>(
    active?.operator ?? "contains",
  );
  const [value, setValue] = useState(active?.value ?? "");

  useEffect(() => {
    if (open) {
      setOperator(active?.operator ?? "contains");
      setValue(active?.value ?? "");
    }
  }, [open, active?.operator, active?.value]);

  const hasActive = Boolean(active?.value);

  const apply = () => {
    const trimmed = value.trim();
    if (!trimmed) {
      onApply(null);
    } else {
      onApply({ operator, value: trimmed });
    }
    setOpen(false);
  };

  const clear = () => {
    setValue("");
    onApply(null);
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(details) => setOpen(details.open)}
      positioning={{ placement: "bottom-start" }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant={hasActive ? "default" : "ghost"}
          size="xs"
          withIcon={false}
          className={cn("h-5 w-5 shrink-0 p-0", !hasActive && "opacity-50 hover:opacity-100")}
          title={hasActive ? `Filter: ${active!.operator} ${active!.value}` : "Filter column"}
          data-testid={`column-header-filter-${columnId}`}
          onClick={(e) => e.stopPropagation()}
        >
          <Filter className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-2 p-2" onClick={(e) => e.stopPropagation()}>
        <form
          className="flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            apply();
          }}
        >
          <select
            className="border-input bg-background h-7 rounded-md border px-1.5 text-xs"
            value={operator}
            onChange={(e) => setOperator(e.target.value as ColumnHeaderFilterOperator)}
            data-testid={`column-header-filter-operator-${columnId}`}
          >
            <option value="contains">contains</option>
            <option value="equals">equals</option>
          </select>
          <input
            className={cn(inputVariants({ size: "sm" }), "h-7 flex-1 text-xs")}
            placeholder="Value…"
            value={value}
            autoFocus
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setOpen(false);
              }
            }}
            data-testid={`column-header-filter-value-${columnId}`}
          />
        </form>
        <div className="flex justify-end gap-1">
          {hasActive && (
            <Button type="button" variant="ghost" size="xs" className="h-7 gap-1" onClick={clear}>
              <X className="h-3 w-3" />
              Clear
            </Button>
          )}
          <Button type="button" size="xs" className="h-7" onClick={apply}>
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
