import { useState, useMemo } from "react";
import { useNaturalLanguageSearch } from "#src/hooks/use-natural-language-search";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Lightbulb, AlertCircle, X } from "lucide-react";
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

	const { parse } = useNaturalLanguageSearch();

	const [open, setOpen] = useState(false);

	const handleSearch = () => {
		if (!input.trim()) {
			setResult(null);
			return;
		}

		const parsed = parse(input, availableColumns);
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

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		handleSearch();
	};

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

	const handleHintSelect = (details: { value: string[] }) => {
		const selectedValue = details.value?.[0];
		if (!selectedValue) return;

		setInput(selectedValue);
		setOpen(false);

		// run search immediately
		const parsed = parse(selectedValue, availableColumns);
		setResult(parsed);
		if (parsed.success && onApplyFilters) {
			onApplyFilters(parsed);
		}
	};

	return (
		<div className={`space-y-2 ${className}`}>
			<form onSubmit={handleSubmit} className="flex gap-2 items-center">
				<div className="flex-1 relative">
					<Popover.Root
						open={open}
						onOpenChange={(e) => setOpen(e.open)}
						initialFocusEl={() => document.getElementById("nls-input")}
					>
						<Popover.Trigger asChild>
							<div>
								<Input
									id="nls-input"
									placeholder={placeholder}
									value={input}
									onChange={(e) => setInput(e.target.value)}
									className="pr-10"
								/>
							</div>
						</Popover.Trigger>

						{input && (
							<button
								type="button"
								onClick={handleClear}
								className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
							>
								<X className="w-4 h-4" />
							</button>
						)}

						<Portal>
							<Popover.Positioner>
								<Popover.Content className="bg-card border border-border rounded-md shadow-lg z-50 w-96">
									<div className="space-y-2 p-3">
										<Listbox.Root
											collection={hintCollection}
											onValueChange={handleHintSelect}
										>
											<div className="flex items-center gap-2 text-xs font-medium text-foreground mb-2">
												<Lightbulb className="w-3 h-3" />
												<span>
													{input
														? "Suggestions for next token"
														: "Start typing or pick a column"}{" "}
												</span>
											</div>
											<Listbox.Content className="max-h-72 overflow-y-auto space-y-1">
												{hintCollection.items.length > 0 ? (
													<Listbox.ItemGroup>
														{hintCollection.items.map((item) => (
															<Listbox.Item
																key={item.value}
																item={item}
																className="px-3 py-2 text-sm cursor-pointer hover:bg-muted data-highlighted:bg-accent transition-colors rounded truncate"
															>
																<Listbox.ItemText>
																	{item.label}
																</Listbox.ItemText>
															</Listbox.Item>
														))}
													</Listbox.ItemGroup>
												) : (
													<div className="px-3 py-2 text-xs text-muted-foreground text-center">
														No suggestions available
													</div>
												)}
											</Listbox.Content>
										</Listbox.Root>
									</div>
								</Popover.Content>
							</Popover.Positioner>
						</Portal>
					</Popover.Root>
				</div>
				<Button
					type="submit"
					variant="default"
					size="sm"
					disabled={!input.trim()}
				>
					Search
				</Button>
			</form>

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
