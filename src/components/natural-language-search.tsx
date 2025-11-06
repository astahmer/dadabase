import { useState, useMemo } from "react";
import { useNaturalLanguageSearch } from "#src/hooks/use-natural-language-search";
import { Button } from "./ui/button";
import { Lightbulb, AlertCircle } from "lucide-react";
import { Popover } from "@ark-ui/react/popover";
import { Portal } from "@ark-ui/react/portal";
import { Listbox, createListCollection } from "@ark-ui/react/listbox";
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
	const [open, setOpen] = useState(false);

	const { parse } = useNaturalLanguageSearch();

	// Generate context-aware suggestions based on input
	const suggestions = useMemo(() => {
		if (!input) {
			return getInitialExamples(availableColumns);
		}

		const context = analyzeQueryState(input, availableColumns);
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

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setInput(e.target.value);
	};

	const handleSuggestionSelect = (details: { value: string[] }) => {
		const selectedValue = details.value?.[0];
		if (!selectedValue) return;

		setInput(selectedValue);
		setOpen(false);

		// Parse and apply immediately
		const parsed = parse(selectedValue, availableColumns);
		setResult(parsed);
		if (parsed.success && onApplyFilters) {
			onApplyFilters(parsed);
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

	const handleClear = () => {
		setInput("");
		setResult(null);
		if (onApplyFilters) {
			onApplyFilters({ filters: [] });
		}
	};

	return (
		<div className={`space-y-2 ${className}`}>
			<div className="flex gap-2 items-start">
				<Popover.Root open={open} onOpenChange={(e) => setOpen(e.open)}>
					<Popover.Trigger asChild>
						<div className="flex-1">
							<div className="relative h-9 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 transition-[color,box-shadow]">
								<input
									type="text"
									placeholder={placeholder}
									value={input}
									onChange={handleInputChange}
									onKeyDown={handleKeyDown}
									className="w-full h-full bg-transparent outline-none placeholder:text-muted-foreground/70"
								/>
								{input && (
									<button
										type="button"
										onClick={handleClear}
										className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
										aria-label="Clear input"
									>
										<svg
											className="w-4 h-4"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
										>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth={2}
												d="M6 18L18 6M6 6l12 12"
											/>
										</svg>
									</button>
								)}
							</div>
						</div>
					</Popover.Trigger>

					<Portal>
						<Popover.Positioner>
							<Popover.Content className="bg-card border border-border rounded-md shadow-lg z-50 w-96 p-0">
								<Listbox.Root
									collection={hintCollection}
									onValueChange={handleSuggestionSelect}
								>
									<div className="px-3 py-2 border-b border-border flex items-center gap-2 text-xs font-medium text-foreground">
										<Lightbulb className="w-3 h-3 shrink-0" />
										<span>
											{input
												? "Suggestions for next token"
												: "Start typing or pick a column"}
										</span>
									</div>
									<Listbox.Content className="max-h-72 overflow-y-auto">
										{hintCollection.items.length > 0 ? (
											hintCollection.items.map((item) => (
												<Listbox.Item
													key={item.value}
													item={item}
													className="px-3 py-2 text-sm cursor-pointer hover:bg-muted data-highlighted:bg-accent transition-colors text-foreground data-highlighted:text-accent-foreground truncate"
												>
													{item.label}
												</Listbox.Item>
											))
										) : (
											<div className="px-3 py-2 text-xs text-muted-foreground text-center">
												No suggestions available
											</div>
										)}
									</Listbox.Content>
								</Listbox.Root>
							</Popover.Content>
						</Popover.Positioner>
					</Portal>
				</Popover.Root>
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
