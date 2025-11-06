import { useState, useMemo } from "react";
import { useNaturalLanguageSearch } from "#src/hooks/use-natural-language-search";
import { Button } from "./ui/button";
import { Lightbulb, AlertCircle, ChevronDown } from "lucide-react";
import { Popover } from "@ark-ui/react/popover";
import { Portal } from "@ark-ui/react/portal";
import {
	Listbox,
	createListCollection,
	useListbox,
} from "@ark-ui/react/listbox";
import type { ParsedNLQuery } from "#src/lib/natural-language-parser";
import {
	analyzeQueryState,
	generateSuggestions,
	getInitialExamples,
} from "#src/lib/query-state-machine";
import { Tooltip } from "./ui/tooltip.tsx";
import { cn } from "../lib/utils.ts";
import { Kbd } from "./ui/kbd.tsx";

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
		<div className={cn("flex gap-2 items-start", className)}>
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
						className="justify-between w-full text-left font-normal"
					>
						<span className="truncate">{displayText}</span>
						<ChevronDown className="w-4 h-4 ml-2 shrink-0 opacity-50" />
					</Button>
				</Popover.Trigger>

				<Portal>
					<Popover.Positioner>
						<Popover.Content className="bg-card border border-border rounded-md shadow-lg z-50 w-full p-0">
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
										className="w-full h-9 px-3 py-2 bg-transparent outline-none border-b border-border placeholder:text-muted-foreground/70 focus:ring-0 focus:border-ring"
										autoFocus
									/>
								</Listbox.Input>
								<Listbox.Content className="max-h-72 overflow-y-auto">
									{collection.items.length > 0 ? (
										collection.items.map((item) => (
											<Listbox.Item
												key={item.value}
												item={item}
												className="px-3 py-2 text-sm cursor-pointer hover:bg-muted data-highlighted:bg-accent data-highlighted:text-accent-foreground transition-colors text-foreground truncate"
												onClick={() => {
													onValueChange(item.value);
												}}
											>
												<div className="flex items-center gap-2 justify-between">
													<span>{item.label}</span>
												</div>
											</Listbox.Item>
										))
									) : inputValue && result?.success ? (
										// Show success message if query is complete and valid
										<Button
											type="button"
											variant="link"
											size="sm"
											onClick={() => {
												onApplyFilters(result);
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
										<div className="px-3 py-2 text-xs text-muted-foreground text-center">
											No suggestions available
										</div>
									)}
								</Listbox.Content>

								{!result && (
									<div className="border-t border-border px-3 py-2 flex items-center gap-2 text-xs font-medium text-foreground bg-muted/30">
										<Lightbulb className="w-3 h-3 shrink-0" />
										<span>
											{inputValue
												? "Suggestions for next token"
												: "Start typing or pick a column"}
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
