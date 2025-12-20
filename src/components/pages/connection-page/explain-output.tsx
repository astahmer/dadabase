import { AlertTriangle, ChevronDown, Zap } from "lucide-react";
import { useState } from "react";
import { Tooltip } from "#src/components/ui/tooltip.tsx";
import { cn } from "#src/lib/utils.ts";

// Memoized number formatter to avoid recreating on each render
const numberFormatter = new Intl.NumberFormat();
function formatNumber(num: number): string {
	return numberFormatter.format(num);
}

interface ExplainNode {
	name: string;
	level: number;
	cost: string;
	rows: string;
	actualRows: string;
	time: string;
	actualTime: number;
	details: Record<string, string>;
}

/**
 * Parse PostgreSQL EXPLAIN ANALYZE output into structured nodes
 */
function parseExplainOutput(output: string): {
	nodes: ExplainNode[];
	totals: { planningTime: string; executionTime: string };
} {
	const lines = output.split("\n");
	const nodes: ExplainNode[] = [];
	let planningTime = "";
	let executionTime = "";

	for (const line of lines) {
		// Extract timing info
		if (line.includes("Planning Time:")) {
			planningTime = line.split(":")[1]?.trim() || "";
		}
		if (line.includes("Execution Time:")) {
			executionTime = line.split(":")[1]?.trim() || "";
		}

		// Skip timing lines and empty lines
		if (
			!line.trim() ||
			line.includes("Planning Time") ||
			line.includes("Execution Time")
		) {
			continue;
		}

		// Parse operation lines - keep exact spacing for cascading effect
		const indentMatch = line.match(/^(\s*)/);
		const level = indentMatch ? indentMatch[1].length : 0; // Keep exact spacing

		// Extract cost information
		const costMatch = line.match(/cost=([\d.]+)\.\.([\d.]+)\s+rows=(\d+)/);
		const actualMatch = line.match(
			/actual time=([\d.]+)\.\.([\d.]+)\s+rows=(\d+)/,
		);
		const nodeNameMatch = line.match(/^\s*(?:->)?\s*(.+?)\s*(?:\(|$)/);

		if (nodeNameMatch) {
			const actualTimeValue = actualMatch ? actualMatch[2] : null;
			const actualTimeMs = actualTimeValue ? parseFloat(actualTimeValue) : NaN;

			nodes.push({
				name: nodeNameMatch[1].trim(),
				level,
				cost: costMatch ? `${costMatch[1]} - ${costMatch[2]}` : "N/A",
				rows: costMatch ? costMatch[3] : "N/A",
				actualRows: actualMatch ? actualMatch[3] : "N/A",
				time: actualMatch ? `${actualMatch[1]} - ${actualMatch[2]}` : "N/A",
				actualTime: actualTimeMs,
				details: {
					rawLine: line.trim(),
				},
			});
		}
	}

	return {
		nodes,
		totals: {
			planningTime,
			executionTime,
		},
	};
}

/**
 * Get performance tier color based on execution time
 */
function getPerformanceColor(timeMs: number): {
	bg: string;
	text: string;
	badge: string;
} {
	if (timeMs > 10)
		return {
			bg: "bg-red-50",
			text: "text-red-700",
			badge: "bg-red-100 text-red-700",
		};
	if (timeMs > 1)
		return {
			bg: "bg-yellow-50",
			text: "text-yellow-700",
			badge: "bg-yellow-100 text-yellow-700",
		};
	if (timeMs > 0.1)
		return {
			bg: "bg-blue-50",
			text: "text-blue-700",
			badge: "bg-blue-100 text-blue-700",
		};
	return {
		bg: "bg-green-50",
		text: "text-green-700",
		badge: "bg-green-100 text-green-700",
	};
}

interface ExplainNodeProps {
	node: ExplainNode;
	maxTime: number;
	isExpensive: boolean;
}

function ExplainNodeRow({ node, maxTime, isExpensive }: ExplainNodeProps) {
	const [expanded, setExpanded] = useState(false);
	const actualTimeMs = node.actualTime;
	const hasValidTime = !isNaN(actualTimeMs);
	const percentOfMax =
		hasValidTime && maxTime > 0 ? (actualTimeMs / maxTime) * 100 : 0;
	const perf = hasValidTime ? getPerformanceColor(actualTimeMs) : null;

	return (
		<div className="border-b border-gray-200 last:border-b-0">
			<button
				className={cn(
					"w-full p-4 text-left transition-all duration-200",
					"hover:bg-gray-50 active:bg-gray-100",
					isExpensive && perf?.bg,
					!hasValidTime && "cursor-default hover:bg-white",
				)}
				onClick={() => hasValidTime && setExpanded(!expanded)}
				disabled={!hasValidTime}
			>
				<div className="flex items-center gap-3">
					{/* Expand/Collapse Icon */}
					<div
						className="shrink-0 w-5 flex items-center justify-center"
						style={{ marginLeft: `${node.level * 0.75}rem` }}
					>
						{hasValidTime ? (
							<button
								className="flex items-center justify-center transition-transform"
								style={{
									transform: expanded ? "rotate(0deg)" : "rotate(-90deg)",
								}}
								onClick={(e) => {
									e.stopPropagation();
									setExpanded(!expanded);
								}}
							>
								<ChevronDown className="h-4 w-4 text-gray-400" />
							</button>
						) : (
							<div className="w-4 h-4" />
						)}
					</div>

					{/* Warning Icon */}
					{isExpensive && perf && (
						<AlertTriangle
							className="h-4 w-4 shrink-0"
							style={{ color: perf.text.split("-")[1] }}
						/>
					)}

					{/* Operation Name */}
					<div className="flex-1 min-w-0">
						<div className="font-medium text-sm text-gray-900 truncate">
							{node.name}
						</div>
					</div>
					{/* Performance Bar */}
					{hasValidTime && (
						<div className="hidden sm:flex items-center gap-2 shrink-0">
							<div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
								<div
									className={cn(
										"h-full transition-all duration-300",
										perf?.badge.split(" ")[0],
									)}
									style={{ width: `${Math.min(percentOfMax, 100)}%` }}
								/>
							</div>
						</div>
					)}

					{/* Metrics */}
					<div className="flex items-center gap-2 shrink-0">
						{hasValidTime && perf && (
							<Tooltip content={`${actualTimeMs.toFixed(3)}ms execution time`}>
								<div
									className={cn(
										"px-2 py-1 rounded text-xs font-semibold whitespace-nowrap",
										perf.badge,
									)}
								>
									<Zap className="inline h-3 w-3 mr-0.5" />
									{actualTimeMs > 1
										? `${actualTimeMs.toFixed(2)}ms`
										: `${(actualTimeMs * 1000).toFixed(0)}µs`}
								</div>
							</Tooltip>
						)}
						{node.actualRows !== "N/A" && (
							<Tooltip content={`Rows returned`}>
								<div className="px-2 py-1 rounded text-xs font-medium bg-gray-100 text-gray-700 whitespace-nowrap">
									{formatNumber(Number(node.actualRows))} rows
								</div>
							</Tooltip>
						)}
					</div>
				</div>
			</button>

			{/* Expanded Details */}
			{expanded && (
				<div className="bg-gray-50 border-t border-gray-200 px-8 py-4 space-y-4 animate-in fade-in">
					{/* Full Operation Name */}
					<div>
						<div className="text-xs text-gray-600 font-semibold mb-1">
							Operation
						</div>
						<div className="text-sm font-mono text-gray-900 wrap-break-word">
							{node.name}
						</div>
					</div>

					<div className="grid grid-cols-2 gap-4">
						{node.cost !== "N/A" && (
							<div>
								<div className="text-xs text-gray-600 font-semibold">
									Estimated Cost
								</div>
								<div className="text-sm font-mono text-gray-900 wrap-break-word">
									{node.cost}
								</div>
							</div>
						)}
						{node.rows !== "N/A" && (
							<div>
								<div className="text-xs text-gray-600 font-semibold">
									Estimated Rows
								</div>
								<div className="text-sm font-mono text-gray-900">
									{node.rows}
								</div>
							</div>
						)}
						{node.time !== "N/A" && (
							<div>
								<div className="text-xs text-gray-600 font-semibold">
									Actual Time (ms)
								</div>
								<div className="text-sm font-mono text-gray-900">
									{node.time}
								</div>
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}

interface ExplainOutputProps {
	output: string;
	viewMode: "smart" | "raw";
	onViewModeChange: (mode: "smart" | "raw") => void;
}

export function ExplainOutput({ output, viewMode }: ExplainOutputProps) {
	const { nodes, totals } = parseExplainOutput(output);

	const executionTimeMs = parseFloat(totals.executionTime) || 0;
	const maxTime = Math.max(...nodes.map((n) => n.actualTime || 0));

	// Find bottleneck (slowest operation)
	const bottleneck = nodes.reduce((max, node) => {
		const time = node.actualTime || 0;
		const prevTime = max.actualTime || 0;
		return time > prevTime ? node : max;
	}, nodes[0]);

	// Find high-cost operations
	const expensiveOps = nodes.filter(
		(n) => !isNaN(n.actualTime) && n.actualTime > 5,
	);

	return (
		<div className="flex flex-col h-full bg-white">
			{/* Performance Summary */}
			{viewMode === "smart" && (
				<div className="px-6 py-4 bg-blue-50 border-b border-blue-200">
					<div className="grid grid-cols-3 gap-4">
						<div>
							<div className="text-xs text-blue-600 font-semibold uppercase tracking-wide">
								Planning
							</div>
							<div className="text-lg font-bold text-blue-900 mt-1">
								{totals.planningTime}
							</div>
						</div>
						<div>
							<div className="text-xs text-blue-600 font-semibold uppercase tracking-wide">
								Execution
							</div>
							<div className="text-lg font-bold text-blue-900 mt-1">
								{totals.executionTime}
							</div>
						</div>
						<div>
							<div className="text-xs text-blue-600 font-semibold uppercase tracking-wide">
								Total
							</div>
							<div className="text-lg font-bold text-blue-900 mt-1">
								{(
									parseFloat(totals.planningTime) +
									parseFloat(totals.executionTime)
								).toFixed(2)}
								ms
							</div>
						</div>
					</div>

					{/* Bottleneck Alert */}
					{expensiveOps.length > 0 &&
						bottleneck &&
						!isNaN(bottleneck.actualTime) && (
							<div className="mt-4 p-3 bg-red-100 border border-red-300 rounded-lg">
								<div className="flex items-start gap-2">
									<AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
									<div className="text-sm">
										<div className="font-semibold text-red-900">
											Bottleneck Detected
										</div>
										<div className="text-red-800 text-xs mt-1">
											<span className="font-mono">{bottleneck.name}</span> took{" "}
											<span className="font-bold">
												{bottleneck.actualTime.toFixed(2)}ms
											</span>{" "}
											(
											{(
												(bottleneck.actualTime / executionTimeMs) *
												100
											).toFixed(1)}
											% of execution time)
										</div>
									</div>
								</div>
							</div>
						)}
				</div>
			)}

			{/* Content */}
			<div className="flex-1 overflow-y-auto">
				{viewMode === "smart" ? (
					<div className="divide-y divide-gray-200">
						{nodes.length > 0 && (
							<div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
								<div className="text-xs font-semibold text-gray-600 uppercase">
									{formatNumber(nodes.length)} Operations
								</div>
							</div>
						)}
						{nodes.map((node, idx) => {
							const isExpensive =
								!isNaN(node.actualTime) && node.actualTime > 5;
							return (
								<ExplainNodeRow
									key={idx}
									node={node}
									maxTime={maxTime}
									isExpensive={isExpensive}
								/>
							);
						})}
					</div>
				) : (
					<div className="p-6">
						<pre className="text-xs font-mono bg-gray-50 p-4 rounded border border-gray-200 overflow-auto max-h-[60vh]">
							<code>{output}</code>
						</pre>
					</div>
				)}
			</div>
		</div>
	);
}
