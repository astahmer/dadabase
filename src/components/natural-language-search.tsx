import { useState, useMemo } from "react";
import { useNaturalLanguageSearch } from "#src/hooks/use-natural-language-search";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Lightbulb, AlertCircle, X } from "lucide-react";
import { Popover } from "@ark-ui/react/popover";
import { Portal } from "@ark-ui/react/portal";
import { Listbox, createListCollection } from "@ark-ui/react/listbox";
import type { ParsedNLQuery } from "#src/lib/natural-language-parser";

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
	console.log(result);

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

	// Build hint items
	const hintCollection = useMemo(
		() =>
			createListCollection({
				items: (() => {
					const items: Array<{ label: string; value: string }> = [];

					if (availableColumns[0]) {
						items.push({
							label: `${availableColumns[0]} equals something`,
							value: `${availableColumns[0]} equals something`,
						});
						items.push({
							label: `${availableColumns[0]} > 100`,
							value: `${availableColumns[0]} > 100`,
						});
						items.push({
							label: `${availableColumns[0]} contains foo`,
							value: `${availableColumns[0]} contains foo`,
						});
					}

					if (availableColumns[1]) {
						items.push({
							label: `sort by ${availableColumns[1]} desc`,
							value: `sort by ${availableColumns[1]} desc`,
						});
					}

					items.push({
						label: "limit 10",
						value: "limit 10",
					});

					return items;
				})(),
			}),
		[availableColumns],
	);

	const handleHintSelect = (details: { value: string[] }) => {
		const value = details.value?.[0];
		if (!value) return;

		setInput(value);
		setOpen(false);
		// run search immediately
		const parsed = parse(value, availableColumns);
		setResult(parsed);
		if (parsed.success && onApplyFilters) {
			onApplyFilters(parsed);
		}
	};

	return (
		<div className={`space-y-2 ${className}`}>
			<form onSubmit={handleSubmit} className="flex gap-2 items-center">
				<div className="flex-1 relative">
					<Popover.Root open={open} onOpenChange={(e) => setOpen(e.open)}>
						<Popover.Trigger asChild>
							<div>
								<Input
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
								<Popover.Content className="bg-card border border-border rounded-md shadow-lg z-50 w-72">
									<Listbox.Root
										collection={hintCollection}
										onValueChange={handleHintSelect}
									>
										<div className="p-3 border-b border-border flex items-center gap-2 text-xs font-medium text-foreground">
											<Lightbulb className="w-3 h-3" />
											Query Examples:
										</div>
										<Listbox.Content className="max-h-64 overflow-y-auto">
											{hintCollection.items.length > 0 ? (
												<Listbox.ItemGroup>
													{hintCollection.items.map((item) => (
														<Listbox.Item
															key={item.value}
															item={item}
															className="px-3 py-2 text-sm cursor-pointer hover:bg-muted data-highlighted:bg-accent transition-colors truncate"
														>
															<Listbox.ItemText>{item.label}</Listbox.ItemText>
														</Listbox.Item>
													))}
												</Listbox.ItemGroup>
											) : (
												<div className="px-3 py-2 text-xs text-muted-foreground text-center">
													No hints available
												</div>
											)}
										</Listbox.Content>
									</Listbox.Root>
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
