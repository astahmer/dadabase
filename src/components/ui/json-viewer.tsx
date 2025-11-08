import { useState, useCallback, memo } from "react";
import { ChevronDown, Copy } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "./button";

interface JsonViewerProps {
	data: unknown;
	defaultExpanded?: boolean;
	maxDepth?: number;
	className?: string;
}

const JsonViewer = memo(function JsonViewer({
	data,
	defaultExpanded = false,
	maxDepth = 10,
	className,
}: JsonViewerProps) {
	return (
		<div className={cn("font-mono text-sm", className)}>
			<JsonValue
				value={data}
				depth={0}
				maxDepth={maxDepth}
				defaultExpanded={defaultExpanded}
			/>
		</div>
	);
});

interface JsonValueProps {
	value: unknown;
	depth: number;
	maxDepth: number;
	defaultExpanded?: boolean;
}

const JsonValue = memo(function JsonValue({
	value,
	depth,
	maxDepth,
	defaultExpanded = false,
}: JsonValueProps) {
	const [isExpanded, setIsExpanded] = useState(defaultExpanded || depth === 0);

	if (value === null) {
		return <span className="text-yellow-600 dark:text-yellow-500">null</span>;
	}

	if (typeof value === "boolean") {
		return (
			<span className="text-yellow-600 dark:text-yellow-500">
				{String(value)}
			</span>
		);
	}

	if (typeof value === "number") {
		return <span className="text-cyan-600 dark:text-cyan-400">{value}</span>;
	}

	if (typeof value === "string") {
		return (
			<span className="text-green-600 dark:text-green-400">"{value}"</span>
		);
	}

	if (Array.isArray(value)) {
		return (
			<JsonArray
				array={value}
				depth={depth}
				maxDepth={maxDepth}
				isExpanded={isExpanded}
				onToggle={() => setIsExpanded(!isExpanded)}
				defaultExpanded={defaultExpanded}
			/>
		);
	}

	if (typeof value === "object") {
		return (
			<JsonObject
				object={value as Record<string, unknown>}
				depth={depth}
				maxDepth={maxDepth}
				isExpanded={isExpanded}
				onToggle={() => setIsExpanded(!isExpanded)}
				defaultExpanded={defaultExpanded}
			/>
		);
	}

	return (
		<span className="text-gray-600 dark:text-gray-400">{String(value)}</span>
	);
});

interface JsonObjectProps {
	object: Record<string, unknown>;
	depth: number;
	maxDepth: number;
	isExpanded: boolean;
	onToggle: () => void;
	defaultExpanded?: boolean;
}

const JsonObject = memo(function JsonObject({
	object,
	depth,
	maxDepth,
	isExpanded,
	onToggle,
	defaultExpanded,
}: JsonObjectProps) {
	const keys = Object.keys(object);
	const isEmpty = keys.length === 0;
	const canExpand = !isEmpty && depth < maxDepth;

	return (
		<>
			<span className="text-gray-800 dark:text-gray-200">{`{`}</span>
			{!isEmpty && (
				<>
					{canExpand && (
						<button
							onClick={onToggle}
							className="inline-flex items-center ml-1 p-0 h-4 w-4 hover:bg-muted rounded"
							aria-label={isExpanded ? "Collapse" : "Expand"}
						>
							<ChevronDown
								size={16}
								className={cn(
									"transition-transform",
									isExpanded ? "" : "-rotate-90",
								)}
							/>
						</button>
					)}
					{isExpanded ? (
						<div className="ml-4 border-l border-muted">
							{keys.map((key, index) => (
								<div key={key} className="py-0.5">
									<span className="text-blue-600 dark:text-blue-400">
										"{key}"
									</span>
									<span className="text-gray-800 dark:text-gray-200">{`: `}</span>
									<JsonValue
										value={object[key]}
										depth={depth + 1}
										maxDepth={maxDepth}
										defaultExpanded={defaultExpanded}
									/>
									{index < keys.length - 1 && (
										<span className="text-gray-800 dark:text-gray-200">,</span>
									)}
								</div>
							))}
						</div>
					) : (
						<span className="text-gray-600 dark:text-gray-400 ml-1">…</span>
					)}
				</>
			)}
			<span className="text-gray-800 dark:text-gray-200">{`}`}</span>
		</>
	);
});

interface JsonArrayProps {
	array: unknown[];
	depth: number;
	maxDepth: number;
	isExpanded: boolean;
	onToggle: () => void;
	defaultExpanded?: boolean;
}

const JsonArray = memo(function JsonArray({
	array,
	depth,
	maxDepth,
	isExpanded,
	onToggle,
	defaultExpanded,
}: JsonArrayProps) {
	const isEmpty = array.length === 0;
	const canExpand = !isEmpty && depth < maxDepth;

	return (
		<>
			<span className="text-gray-800 dark:text-gray-200">{`[`}</span>
			{!isEmpty && (
				<>
					{canExpand && (
						<button
							onClick={onToggle}
							className="inline-flex items-center ml-1 p-0 h-4 w-4 hover:bg-muted rounded"
							aria-label={isExpanded ? "Collapse" : "Expand"}
						>
							<ChevronDown
								size={16}
								className={cn(
									"transition-transform",
									isExpanded ? "" : "-rotate-90",
								)}
							/>
						</button>
					)}
					{isExpanded ? (
						<div className="ml-4 border-l border-muted">
							{array.map((item, index) => (
								<div key={index} className="py-0.5">
									<JsonValue
										value={item}
										depth={depth + 1}
										maxDepth={maxDepth}
										defaultExpanded={defaultExpanded}
									/>
									{index < array.length - 1 && (
										<span className="text-gray-800 dark:text-gray-200">,</span>
									)}
								</div>
							))}
						</div>
					) : (
						<span className="text-gray-600 dark:text-gray-400 ml-1">…</span>
					)}
				</>
			)}
			<span className="text-gray-800 dark:text-gray-200">{`]`}</span>
		</>
	);
});

interface JsonViewerModalProps {
	data: unknown;
	className?: string;
}

export const JsonViewerModal = memo(function JsonViewerModal({
	data,
	className,
}: JsonViewerModalProps) {
	const [copied, setCopied] = useState(false);

	const handleCopy = useCallback(() => {
		navigator.clipboard.writeText(JSON.stringify(data, null, 2));
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}, [data]);

	return (
		<div className={cn("flex flex-col gap-3", className)}>
			<div className="flex items-center justify-between">
				<span className="text-sm font-medium text-foreground">JSON Data</span>
				<Button
					size="sm"
					variant="ghost"
					onClick={handleCopy}
					className="h-7 gap-2"
				>
					<Copy size={14} />
					{copied ? "Copied!" : "Copy"}
				</Button>
			</div>
			<div className="bg-muted p-3 rounded border border-border overflow-auto max-h-96">
				<JsonViewer data={data} defaultExpanded={true} />
			</div>
		</div>
	);
});

export { JsonViewer };
