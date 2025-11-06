import { useState, useMemo } from "react";
import { useNaturalLanguageSearch } from "#src/hooks/use-natural-language-search";
import { Button } from "./ui/button";
import { Lightbulb, AlertCircle } from "lucide-react";
import {
	Combobox,
	ComboboxControl,
	ComboboxInput,
	ComboboxContent,
	ComboboxList,
	ComboboxItem,
	ComboboxItemGroup,
	ComboboxItemText,
	ComboboxClearTrigger,
	createListCollection,
} from "./ui/combobox";
import type { ParsedNLQuery } from "#src/lib/natural-language-parser";
import {
	analyzeQueryState,
	generateSuggestions,
	getInitialExamples,
} from "#src/lib/query-state-machine";

interface NaturalLanguageSearchProps {
	availableColumns: string[];
	onApplyFilters?: (
		parsed: Pick<ParsedNLQuery, "filters" | "orderBy" | "limit">,
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
	const [input, setInput] = useState("");
	const [result, setResult] = useState<ParsedNLQuery | null>(null);

	const { parse } = useNaturalLanguageSearch();

	// Generate context-aware suggestions
	const suggestions = useMemo(() => {
		if (!input) {
			// Show initial examples when empty
			return getInitialExamples(availableColumns);
		}

		// Analyze current query state
		const context = analyzeQueryState(input, availableColumns);

		// Generate suggestions based on state
		return generateSuggestions(context, availableColumns);
	}, [input, availableColumns]);

	// Build listbox collection
	const hintCollection = useMemo(
		() =>
			createListCollection({
				items: suggestions.map((suggestion) => ({
					label: suggestion.label,
					value: suggestion.value,
				})),
			}),
		[suggestions],
	);

	const handleInputChange = (details: any) => {
		setInput(details.inputValue || "");
	};

	const handleValueChange = (details: { value: string[] }) => {
		const selectedValue = details.value?.[0];
		if (!selectedValue) return;

		setInput(selectedValue);

		// Parse and apply immediately
		const parsed = parse(selectedValue, availableColumns);
		setResult(parsed);
		if (parsed.success && onApplyFilters) {
			onApplyFilters(parsed);
		}
	};

	const handleClear = () => {
		setInput("");
		setResult(null);
		if (onApplyFilters) {
			onApplyFilters({ filters: [] });
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter" && input.trim()) {
			const parsed = parse(input, availableColumns);
			setResult(parsed);
			if (parsed.success && onApplyFilters) {
				onApplyFilters(parsed);
			}
		}
	};

	return (
		<div className={`space-y-2 ${className}`}>
			<div className="flex gap-2 items-start">
				<Combobox
					collection={hintCollection}
					// value={input ? [input] : []}
					onInputValueChange={handleInputChange}
					onValueChange={handleValueChange}
					openOnClick
					className="flex-1"
				>
					<ComboboxControl>
						<ComboboxInput
							placeholder={placeholder}
							onKeyDown={handleKeyDown}
						/>
						<ComboboxClearTrigger onClick={handleClear} />
					</ComboboxControl>
					<ComboboxContent>
						<div className="p-3 border-b border-border">
							<div className="flex items-center gap-2 text-xs font-medium text-foreground">
								<Lightbulb className="w-3 h-3" />
								<span>
									{input
										? "Suggestions for next token"
										: "Start typing or pick a column"}
								</span>
							</div>
						</div>
						<ComboboxList>
							{hintCollection.items.length > 0 ? (
								<ComboboxItemGroup>
									{hintCollection.items.map((item) => (
										<ComboboxItem key={item.value} item={item}>
											<ComboboxItemText>{item.label}</ComboboxItemText>
										</ComboboxItem>
									))}
								</ComboboxItemGroup>
							) : (
								<div className="px-3 py-2 text-xs text-muted-foreground text-center">
									No suggestions available
								</div>
							)}
						</ComboboxList>
					</ComboboxContent>
				</Combobox>
				<Button
					type="button"
					variant="default"
					size="sm"
					disabled={!input.trim()}
					onClick={() => {
						if (input.trim()) {
							const parsed = parse(input, availableColumns);
							setResult(parsed);
							if (parsed.success && onApplyFilters) {
								onApplyFilters(parsed);
							}
						}
					}}
				>
					Search
				</Button>
			</div>

			{/* Error feedback if parse failed */}
			{result && !result.success && (
				<div className="flex gap-2 items-start text-destructive bg-destructive/10 p-2 rounded text-sm">
					<AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
					<span>{result.message}</span>
				</div>
			)}
		</div>
	);
}
