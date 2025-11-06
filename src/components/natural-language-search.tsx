import { useState } from "react";
import { useNaturalLanguageSearch } from "#src/hooks/use-natural-language-search";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { AlertCircle, Lightbulb, X } from "lucide-react";
import { Popover } from "@ark-ui/react/popover";
import { Portal } from "@ark-ui/react/portal";
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
								<Popover.Content className="bg-card border border-border rounded-md shadow-lg z-50 p-3 w-72">
									<div className="flex items-center gap-2 text-xs font-medium text-foreground">
										<Lightbulb className="w-3 h-3" />
										Query Examples:
									</div>
									<div className="grid gap-1 text-xs text-muted-foreground mt-2">
										{availableColumns[0] && (
											<button
												type="button"
												onClick={() => {
													const col = availableColumns[0];
													const value = `${col} equals something`;
													setInput(value);
													setOpen(false);
													// run search immediately
													const parsed = parse(value, availableColumns);
													setResult(parsed);
													if (parsed.success && onApplyFilters) {
														onApplyFilters(parsed);
													}
												}}
												className="text-left hover:text-foreground hover:bg-muted p-1 rounded truncate"
											>
												{`"${availableColumns[0]} equals something"`}
											</button>
										)}

										{availableColumns[0] && (
											<button
												type="button"
												onClick={() => {
													const col = availableColumns[0];
													const value = `${col} > 100`;
													setInput(value);
													setOpen(false);
													const parsed = parse(value, availableColumns);
													setResult(parsed);
													if (parsed.success && onApplyFilters) {
														onApplyFilters(parsed);
													}
												}}
												className="text-left hover:text-foreground hover:bg-muted p-1 rounded truncate"
											>
												{`"${availableColumns[0]} > 100"`}
											</button>
										)}

										{availableColumns[0] && (
											<button
												type="button"
												onClick={() => {
													const col = availableColumns[0];
													const value = `${col} contains foo`;
													setInput(value);
													setOpen(false);
													const parsed = parse(value, availableColumns);
													setResult(parsed);
													if (parsed.success && onApplyFilters) {
														onApplyFilters(parsed);
													}
												}}
												className="text-left hover:text-foreground hover:bg-muted p-1 rounded truncate"
											>
												{`"${availableColumns[0]} contains foo"`}
											</button>
										)}

										{availableColumns[1] && (
											<button
												type="button"
												onClick={() => {
													const value = `sort by ${availableColumns[1]} desc`;
													setInput(value);
													setOpen(false);
													const parsed = parse(value, availableColumns);
													setResult(parsed);
													if (parsed.success && onApplyFilters) {
														onApplyFilters(parsed);
													}
												}}
												className="text-left hover:text-foreground hover:bg-muted p-1 rounded truncate"
											>
												{`"sort by ${availableColumns[1]} desc"`}
											</button>
										)}

										<button
											type="button"
											onClick={() => {
												const value = "limit 10";
												setInput(value);
												setOpen(false);
												const parsed = parse(value, availableColumns);
												setResult(parsed);
												if (parsed.success && onApplyFilters) {
													onApplyFilters(parsed);
												}
											}}
											className="text-left hover:text-foreground hover:bg-muted p-1 rounded"
										>
											{'"limit 10"'}
										</button>
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
		</div>
	);
}
