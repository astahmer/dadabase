import { createListCollection, Listbox, useListbox } from "@ark-ui/react/listbox";
import { Popover } from "@ark-ui/react/popover";
import { Portal } from "@ark-ui/react/portal";
import { ChevronDown, Lightbulb } from "lucide-react";
import { useMemo, useState } from "react";

import type { ParsedNLQuery } from "#src/components/query-builder/natural-language-parser.ts";

import {
  analyzeQueryState,
  generateSuggestions,
  getInitialExamples,
} from "#src/components/query-builder/query-state-machine.ts";
import { useNaturalLanguageSearch } from "#src/components/query-builder/use-natural-language-search.ts";

import { cn } from "../../lib/utils.ts";
import { Button } from "../ui/button.tsx";
import { Kbd } from "../ui/kbd.tsx";

interface NaturalLanguageSearchProps {
  availableColumns: string[];
  onApplyFilters: (
    parsed: Pick<ParsedNLQuery, "filters" | "orderBy" | "limit"> & {
      clear?: boolean;
    },
  ) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Natural Language Search Input Component
 * Allows users to query data using natural language
 */
export function NaturalLanguageSearch({
  availableColumns,
  onApplyFilters,
  placeholder = 'Try: "age > 25", "sort by name desc", "limit 10"',
  className,
}: NaturalLanguageSearchProps) {
  const [preview, setPreview] = useState("");
  const [inputValue, setInputValue] = useState("");

  const [result, setResult] = useState<ParsedNLQuery | null>(null);
  const [open, setOpen] = useState(false);

  const { parse } = useNaturalLanguageSearch();

  // Generate context-aware suggestions based on input
  const suggestions = useMemo(() => {
    if (!inputValue) {
      return getInitialExamples(availableColumns);
    }

    const context = analyzeQueryState(inputValue, availableColumns);
    return generateSuggestions(context, availableColumns);
  }, [inputValue, availableColumns]);

  // Track query state for determining when query is complete
  const queryState = useMemo(() => {
    if (!inputValue) return null;
    return analyzeQueryState(inputValue, availableColumns);
  }, [inputValue, availableColumns]);

  // Build listbox collection
  const collection = useMemo(
    () =>
      createListCollection({
        items: suggestions.map((suggestion) => ({
          label: suggestion.label,
          value: suggestion.value,
        })),
      }),
    [suggestions],
  );

  const listbox = useListbox({
    collection,
    selectionMode: "none", // Prevent selection
    loopFocus: true,
  });

  // Setup listbox
  const onValueChange = (selectedValue: string) => {
    // Fill the input with the suggestion
    setInputValue(selectedValue);

    if (!selectedValue) {
      return clearState();
    }

    // Parse and check if it's complete
    const parsed = parse(selectedValue, availableColumns);
    setResult(parsed);

    // If query is complete and valid, apply filters immediately
    // if (parsed.success) {
    // 	setPreview(selectedValue);
    // 	if (onApplyFilters) {
    // 		onApplyFilters(parsed);
    // 	}
    // }
  };

  const handleListboxKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Only handle Enter key to fill input with highlighted item
    if (e.key === "Enter") {
      const highlightedItem = listbox.highlightedItem;
      if (highlightedItem) {
        e.preventDefault();
        onValueChange(highlightedItem.value);
      } else if (result?.success) {
        onApplyFilters(result);
        clearState();
      }
    }
  };

  const clearState = () => {
    setPreview("");
    setInputValue("");
    setResult(null);
  };

  const displayText = preview || placeholder;

  return (
    <div className={cn("flex items-start gap-2", className)}>
      {/* {result && !result.success && (
				<Tooltip content="Query is invalid" className="shrink-0">
					<AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-destructive self-center" />
				</Tooltip>
			)} */}
      <Popover.Root
        open={open}
        onOpenChange={(e) => setOpen(e.open)}
        positioning={{ sameWidth: true }}
      >
        <Popover.Trigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-between text-left font-normal"
          >
            <span className="truncate">{displayText}</span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </Popover.Trigger>

        <Portal>
          <Popover.Positioner>
            <Popover.Content className="bg-card border-border z-50 w-full rounded-md border p-0 shadow-lg">
              <Listbox.RootProvider value={listbox}>
                <Listbox.Input
                  asChild
                  onChange={(e) => onValueChange(e.currentTarget.value)}
                  onKeyDown={handleListboxKeyDown}
                >
                  <input
                    type="text"
                    id="nls-input"
                    placeholder={placeholder}
                    value={inputValue}
                    className="border-border placeholder:text-muted-foreground/70 focus:border-ring h-9 w-full border-b bg-transparent px-3 py-2 outline-none focus:ring-0"
                    autoFocus
                  />
                </Listbox.Input>
                <Listbox.Content className="max-h-72 overflow-y-auto">
                  {collection.items.length > 0 ? (
                    collection.items.map((item) => {
                      const suggestion = suggestions.find((s) => s.value === item.value);
                      return (
                        <Listbox.Item
                          key={item.value}
                          item={item}
                          className="hover:bg-muted data-highlighted:bg-accent data-highlighted:text-accent-foreground text-foreground cursor-pointer px-3 py-2 text-sm transition-colors"
                          onClick={() => {
                            onValueChange(item.value);
                          }}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm lowercase">{item.label}</span>
                            {suggestion?.symbols && suggestion.symbols.length > 0 && (
                              <div className="ml-auto flex gap-1">
                                {suggestion.symbols.map((symbol) => (
                                  <Kbd
                                    key={symbol}
                                    variant="outline"
                                    size="sm"
                                    className="text-xs lowercase"
                                  >
                                    {symbol}
                                  </Kbd>
                                ))}
                              </div>
                            )}
                          </div>
                        </Listbox.Item>
                      );
                    })
                  ) : inputValue && (result?.success || queryState?.state === "complete") ? (
                    // Show success message if query is complete and valid
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      onClick={() => {
                        onApplyFilters(result || {});
                        clearState();
                      }}
                      className="w-full rounded-none"
                    >
                      Press
                      <Kbd variant="outline" size="sm">
                        ⏎
                      </Kbd>
                      or click to add filter
                    </Button>
                  ) : (
                    <div className="text-muted-foreground px-3 py-2 text-center text-xs">
                      No suggestions available
                    </div>
                  )}
                </Listbox.Content>

                {!result && (
                  <div className="border-border text-foreground bg-muted/30 flex items-center gap-2 border-t px-3 py-2 text-xs font-medium">
                    <Lightbulb className="h-3 w-3 shrink-0" />
                    <span>
                      {inputValue ? "Suggestions for next token" : "Start typing or pick a column"}
                    </span>
                  </div>
                )}
              </Listbox.RootProvider>
            </Popover.Content>
          </Popover.Positioner>
        </Portal>
      </Popover.Root>

      {preview && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            onApplyFilters({ ...result, clear: true });
            clearState();
          }}
          className="shrink-0"
          aria-label="Clear search"
        >
          ✕
        </Button>
      )}
    </div>
  );
}
