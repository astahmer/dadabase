import { useState } from "react";
import { useNaturalLanguageSearch } from "#src/hooks/use-natural-language-search";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { AlertCircle, Lightbulb, X } from "lucide-react";
import type {
	ParsedNLQuery,
	FilterCondition,
} from "#src/lib/natural-language-parser";

interface NaturalLanguageSearchProps {
	availableColumns: string[];
	onApplyFilters?: (
		filters: FilterCondition[],
		orderBy?: { field: string; direction: "asc" | "desc" },
		limit?: number,
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

	const handleSearch = () => {
		if (!input.trim()) {
			setResult(null);
			return;
		}

		const parsed = parse(input, availableColumns);
		setResult(parsed);

		if (parsed.success && onApplyFilters) {
			onApplyFilters(parsed.filters || [], parsed.orderBy, parsed.limit);
		}
	};

	const handleClear = () => {
		setInput("");
		setResult(null);
		if (onApplyFilters) {
			onApplyFilters([], undefined, undefined);
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
					<Input
						placeholder={placeholder}
						value={input}
						onChange={(e) => setInput(e.target.value)}
						className="pr-10"
					/>
					{input && (
						<button
							type="button"
							onClick={handleClear}
							className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
						>
							<X className="w-4 h-4" />
						</button>
					)}
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

			{/* Result Messages */}
			{result && (
				<div className="text-sm space-y-1">
					{!result.success && (
						<div className="flex gap-2 items-start text-destructive bg-destructive/10 p-2 rounded">
							<AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
							<span>{result.message}</span>
						</div>
					)}

					{result.success && result.filters && result.filters.length > 0 && (
						<div className="text-xs text-muted-foreground">
							<span className="font-medium">Filters applied:</span>
							{result.filters.map((f, i) => (
								<div key={i} className="ml-2 text-foreground">
									{f.field} {f.operator}{" "}
									{Array.isArray(f.value) ? `[${f.value.join(", ")}]` : f.value}
								</div>
							))}
						</div>
					)}

					{result.success && result.orderBy && (
						<div className="text-xs text-muted-foreground">
							<span className="font-medium">Order by:</span>
							<div className="ml-2 text-foreground">
								{result.orderBy.field} {result.orderBy.direction}
							</div>
						</div>
					)}

					{result.success && result.limit && (
						<div className="text-xs text-muted-foreground">
							<span className="font-medium">Limit:</span>
							<div className="ml-2 text-foreground">{result.limit} rows</div>
						</div>
					)}
				</div>
			)}

			{/* Hints */}
			{availableColumns.length > 0 && (
				<div className="bg-muted/50 rounded p-3 space-y-2 border border-input">
					<div className="flex items-center gap-2 text-xs font-medium text-foreground">
						<Lightbulb className="w-3 h-3" />
						Query Examples:
					</div>
					<div className="grid gap-1 text-xs text-muted-foreground">
						<button
							type="button"
							onClick={() => {
								const col = availableColumns[0];
								setInput(`${col} equals something`);
							}}
							className="text-left hover:text-foreground hover:bg-muted p-1 rounded truncate"
						>
							{availableColumns[0]
								? `"${availableColumns[0]} equals something"`
								: "Column equals value"}
						</button>
						<button
							type="button"
							onClick={() => {
								const col = availableColumns[0];
								setInput(`${col} > 100`);
							}}
							className="text-left hover:text-foreground hover:bg-muted p-1 rounded truncate"
						>
							{availableColumns[0]
								? `"${availableColumns[0]} > 100"`
								: "Column > 100"}
						</button>
						<button
							type="button"
							onClick={() => {
								const col = availableColumns[0];
								setInput(`${col} contains text`);
							}}
							className="text-left hover:text-foreground hover:bg-muted p-1 rounded truncate"
						>
							{availableColumns[0]
								? `"${availableColumns[0]} contains text"`
								: "Column contains text"}
						</button>
						{availableColumns[1] && (
							<button
								type="button"
								onClick={() => {
									setInput(`sort by ${availableColumns[1]} desc`);
								}}
								className="text-left hover:text-foreground hover:bg-muted p-1 rounded truncate"
							>
								{`"sort by ${availableColumns[1]} desc"`}
							</button>
						)}
						<button
							type="button"
							onClick={() => {
								setInput("limit 10");
							}}
							className="text-left hover:text-foreground hover:bg-muted p-1 rounded"
						>
							{"'limit 10'"}
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
