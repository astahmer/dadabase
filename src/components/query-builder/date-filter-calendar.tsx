import { CalendarDays } from "lucide-react";

import { Button } from "#src/components/ui/button.tsx";
import { Input } from "#src/components/ui/input.tsx";
import { Label } from "#src/components/ui/label.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "#src/components/ui/popover.tsx";

import { getDateFilterPreset } from "./date-filter-presets.ts";

export type DateFilterCalendarValue = {
  operator: "between";
  value: [string, string];
};

type DateFilterCalendarProps = {
  value?: unknown;
  onChange: (next: DateFilterCalendarValue) => void;
};

const toYmd = (value: unknown, index: 0 | 1): string => {
  if (Array.isArray(value) && typeof value[index] === "string") {
    return value[index];
  }
  return "";
};

/**
 * Native date calendar (from/to) for datetime filter rows.
 * Complements range presets with an explicit calendar picker.
 */
export const DateFilterCalendar = (props: DateFilterCalendarProps) => {
  const from = toYmd(props.value, 0);
  const to = toYmd(props.value, 1);

  const commit = (nextFrom: string, nextTo: string) => {
    if (!nextFrom && !nextTo) return;
    props.onChange({
      operator: "between",
      value: [nextFrom || nextTo, nextTo || nextFrom],
    });
  };

  return (
    <Popover positioning={{ placement: "bottom-start" }}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 shrink-0 px-2"
          title="Pick date range"
          aria-label="Pick date range"
        >
          <CalendarDays className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3">
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="date-filter-from" className="text-xs">
              From
            </Label>
            <Input
              id="date-filter-from"
              type="date"
              className="h-8"
              value={from}
              onChange={(e) => commit(e.target.value, to)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="date-filter-to" className="text-xs">
              To
            </Label>
            <Input
              id="date-filter-to"
              type="date"
              className="h-8"
              value={to}
              onChange={(e) => commit(from, e.target.value)}
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 w-full text-xs"
            onClick={() => {
              const today = getDateFilterPreset("today");
              if (today.operator === "between" && Array.isArray(today.value)) {
                props.onChange({
                  operator: "between",
                  value: [today.value[0], today.value[1]],
                });
              }
            }}
          >
            Jump to today
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};
