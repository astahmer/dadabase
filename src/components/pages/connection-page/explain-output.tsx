import { AlertTriangle, ChevronDown, ChevronRight, Zap } from "lucide-react";
import { useState } from "react";
import { cn } from "#src/lib/utils.ts";

interface ExplainNode {
	name: string;
	level: number;
	cost: string;
	rows: string;
	actualRows: string;
	time: string;
	actualTime: string;
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

		// Parse operation lines (they usually start with spaces and contain ->)
		const indentMatch = line.match(/^(\s*)/);
		const level = indentMatch ? Math.floor(indentMatch[1].length / 2) : 0;

		if (
			line.trim() &&
			!line.includes("Planning Time") &&
			!line.includes("Execution Time")
		) {
			// Extract cost information
			const costMatch = line.match(
				/\(cost=([\d.]+)\.\.(\d+\.?\d*)\s+rows=(\d+)/,
			);
			const actualMatch = line.match(
				/\(actual time=([\d.]+)\.\.([\d.]+)\s+rows=(\d+)/,
			);
			const nodeNameMatch = line.match(/^\s*(?:->|)\s*(.+?)\s*\(/);

			if (costMatch || actualMatch || nodeNameMatch) {
				nodes.push({
					name: nodeNameMatch
						? nodeNameMatch[1].trim()
						: line.trim().substring(0, 40),
					level,
					cost: costMatch ? `${costMatch[1]} - ${costMatch[2]}` : "N/A",
					rows: costMatch ? costMatch[3] : "N/A",
					actualRows: actualMatch ? actualMatch[3] : "N/A",
					time: actualMatch ? `${actualMatch[1]} - ${actualMatch[2]}` : "N/A",
					actualTime: actualMatch ? `${actualMatch[2]}ms` : "N/A",
					details: {
						rawLine: line.trim(),
					},
				});
			}
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

interface ExplainNodeProps {
	node: ExplainNode;
	isExpensive: boolean;
}

function ExplainNodeRow({ node, isExpensive }: ExplainNodeProps) {
	const [expanded, setExpanded] = useState(false);

	const paddingClass = `pl-${Math.min(node.level * 4, 12)}`;

	return (
		<div className="border-b border-gray-200 last:border-b-0">
			<div
				className={cn(
					"p-3 cursor-pointer transition-colors hover:bg-gray-50",
					isExpensive && "bg-red-50 hover:bg-red-100",
				)}
				onClick={() => setExpanded(!expanded)}
				style={{ paddingLeft: `${node.level * 1.5 + 0.75}rem` }}
			>
				<div className="flex items-center gap-2">
					{node.details.rawLine.includes("(") && (
						<button
							className="flex-shrink-0 text-gray-400 hover:text-gray-600"
							onClick={(e) => {
								e.stopPropagation();
								setExpanded(!expanded);
							}}
						>
							{expanded ? (
								<ChevronDown className="h-4 w-4" />
							) : (
								<ChevronRight className="h-4 w-4" />
							)}
						</button>
					)}

					{isExpensive && (
						<AlertTriangle className="h-4 w-4 text-red-500 flex-shrink-0" />
					)}

					<div className="flex-1 min-w-0">
						<div className="font-medium text-sm text-gray-900 truncate">
							{node.name}
						</div>
					</div>

					<div className="flex items-center gap-4 text-xs text-gray-600 flex-shrink-0 whitespace-nowrap">
						{node.actualTime !== "N/A" && (
							<div className="flex items-center gap-1">
								<Zap className="h-3 w-3" />
								<span>{node.actualTime}</span>
							</div>
						)}
						{node.actualRows !== "N/A" && (
							<div>
								<span className="text-gray-500">Rows:</span>{" "}
								<span className="font-semibold">{node.actualRows}</span>
							</div>
						)}
					</div>
				</div>
			</div>

			{expanded && (
				<div className="bg-gray-50 border-t border-gray-200 p-3 text-xs space-y-2">
					<div className="grid grid-cols-2 gap-4">
						{node.cost !== "N/A" && (
							<div>
								<span className="text-gray-600">Estimated Cost:</span>
								<div className="font-mono text-gray-900">{node.cost}</div>
							</div>
						)}
						{node.rows !== "N/A" && (
							<div>
								<span className="text-gray-600">Estimated Rows:</span>
								<div className="font-mono text-gray-900">{node.rows}</div>
							</div>
						)}
						{node.time !== "N/A" && (
							<div>
								<span className="text-gray-600">Actual Time (ms):</span>
								<div className="font-mono text-gray-900">{node.time}</div>
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
}

export function ExplainOutput({ output }: ExplainOutputProps) {
	const { nodes, totals } = parseExplainOutput(output);

	// Detect expensive operations (cost > 1000 or actual time > 1ms)
	const expensiveIndices = new Set(
		nodes
			.map((node, idx) => {
				const costNum = parseFloat(node.cost.split("-")[1] || "0");
				const timeNum = parseFloat(node.actualTime);
				return costNum > 1000 || timeNum > 1 ? idx : -1;
			})
			.filter((idx) => idx !== -1),
	);

	return (
		<div className="flex flex-col h-full">
			{/* Timing Summary */}
			<div className="border-b border-gray-200 bg-gradient-to-r from-blue-50 to-transparent p-4">
				<div className="grid grid-cols-2 gap-4">
					<div>
						<div className="text-xs text-gray-600">Planning Time</div>
						<div className="text-lg font-semibold text-gray-900 font-mono">
							{totals.planningTime || "N/A"}
						</div>
					</div>
					<div>
						<div className="text-xs text-gray-600">Execution Time</div>
						<div className="text-lg font-semibold text-gray-900 font-mono">
							{totals.executionTime || "N/A"}
						</div>
					</div>
				</div>
			</div>

			{/* Nodes List */}
			<div className="flex-1 overflow-auto">
				{nodes.length > 0 ? (
					<div>
						{nodes.map((node, idx) => (
							<ExplainNodeRow
								key={idx}
								node={node}
								isExpensive={expensiveIndices.has(idx)}
							/>
						))}
					</div>
				) : (
					<div className="p-4 text-center text-gray-500">
						<p className="text-sm">Unable to parse explain output</p>
						<p className="text-xs mt-2 text-gray-400">Raw output:</p>
						<pre className="font-mono text-xs whitespace-pre-wrap break-words mt-2 bg-gray-50 p-3 rounded text-left text-gray-700">
							{output}
						</pre>
					</div>
				)}
			</div>
		</div>
	);
}
