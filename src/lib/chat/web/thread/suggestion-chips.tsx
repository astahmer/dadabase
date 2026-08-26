"use client";

import type { ReactNode } from "react";

export const SuggestionChips = ({
  suggestions,
  onSelect,
  disabled = false,
}: {
  suggestions: ReadonlyArray<string>;
  onSelect: (suggestion: string) => void;
  disabled?: boolean;
}): ReactNode => {
  if (suggestions.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2" data-testid="suggestion-chips">
      {suggestions.map((suggestion) => (
        <button
          key={suggestion}
          type="button"
          disabled={disabled}
          className="bg-background hover:bg-accent rounded-full border px-3 py-1.5 text-left text-sm disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => onSelect(suggestion)}
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
};
