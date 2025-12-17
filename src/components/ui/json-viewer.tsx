import { ChevronDown } from "lucide-react";
import { memo, useState } from "react";
import { cn } from "../../lib/utils";
import { renderPrimitiveValue } from "./json-viewer.render-primitive-value";

interface JsonViewerProps {
	data: unknown;
	defaultExpanded?: boolean | number;
	maxDepth?: number;
	className?: string;
}

export const JsonViewer = memo(function JsonViewer({
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
	defaultExpanded?: boolean | number;
	dataKey?: string;
}

export const JsonValue = memo(function JsonValue({
	value,
	depth,
	maxDepth,
	defaultExpanded = false,
	dataKey,
}: JsonValueProps) {
	const [isExpanded, setIsExpanded] = useState(
		(typeof defaultExpanded === "boolean"
			? defaultExpanded
			: typeof defaultExpanded === "number"
				? defaultExpanded <= depth
				: false) || depth <= 1,
	);

	const primitiveRender = renderPrimitiveValue(value);
	if (primitiveRender !== null) {
		return primitiveRender;
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
				dataKey={dataKey}
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
				dataKey={dataKey}
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
	defaultExpanded?: boolean | number;
	dataKey?: string;
}

export const JsonObject = memo(function JsonObject({
	object,
	depth,
	maxDepth,
	isExpanded,
	onToggle,
	defaultExpanded,
	dataKey,
}: JsonObjectProps) {
	const keys = Object.keys(object);
	const isEmpty = keys.length === 0;
	const canExpand = !isEmpty && depth < maxDepth;

	return (
		<div data-json-key={dataKey} className="inline">
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
							{keys.map((key, index) => {
								const value = object[key];
								const isExpandable =
									typeof value === "object" && value !== null;
								const keyId = `${dataKey}-${key}-${index}`;
								return (
									<div key={key} className="py-0.5">
										{isExpandable ? (
											<button
												onClick={(e) => {
													e.preventDefault();
													const jsonValue = document.querySelector(
														`[data-json-key="${keyId}"]`,
													);
													if (jsonValue && jsonValue !== e.currentTarget) {
														// Find the nested JsonValue/JsonObject and toggle it
														const toggleBtn = jsonValue.querySelector("button");
														if (toggleBtn) {
															toggleBtn.click();
														}
													}
												}}
												className="text-blue-600 dark:text-blue-400 hover:opacity-70 transition-opacity"
											>
												"{key}"
											</button>
										) : (
											<span className="text-blue-600 dark:text-blue-400">
												"{key}"
											</span>
										)}
										<span className="text-gray-800 dark:text-gray-200">{`: `}</span>
										<JsonValue
											value={value}
											depth={depth + 1}
											maxDepth={maxDepth}
											defaultExpanded={defaultExpanded}
											dataKey={keyId}
										/>
										{index < keys.length - 1 && (
											<span className="text-gray-800 dark:text-gray-200">
												,
											</span>
										)}
									</div>
								);
							})}
						</div>
					) : (
						<span className="text-gray-600 dark:text-gray-400 ml-1">…</span>
					)}
				</>
			)}
			<span className="text-gray-800 dark:text-gray-200">{`}`}</span>
		</div>
	);
});

interface JsonArrayProps {
	array: unknown[];
	depth: number;
	maxDepth: number;
	isExpanded: boolean;
	onToggle: () => void;
	defaultExpanded?: boolean | number;
	dataKey?: string;
}

export const JsonArray = memo(function JsonArray({
	array,
	depth,
	maxDepth,
	isExpanded,
	onToggle,
	defaultExpanded,
	dataKey,
}: JsonArrayProps) {
	const isEmpty = array.length === 0;
	const canExpand = !isEmpty && depth < maxDepth;

	return (
		<div data-json-key={dataKey} className="inline">
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
										dataKey={`${dataKey}-${index}`}
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
		</div>
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
	return (
		<div className={cn("flex flex-col gap-3 min-h-0 h-full", className)}>
			<div className="bg-muted p-3 rounded border border-border overflow-auto min-h-0 h-full">
				<JsonViewer data={data} defaultExpanded={true} />
			</div>
		</div>
	);
});
