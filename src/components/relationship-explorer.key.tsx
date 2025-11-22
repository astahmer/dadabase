import { ChevronDown, Loader2 } from "lucide-react";
import { memo, useState } from "react";
import type { TableRelationship } from "#src/types/relationships.ts";
import { cn } from "#src/lib/utils";
import { RelationshipExplorerRows } from "#src/components/relationship-explorer.rows";

interface RelationshipExplorerKeyProps {
	relationship: TableRelationship;
	count: number;
	isExpanded: boolean;
	onToggle: () => void;
	connectionUrl: string;
	row: Record<string, unknown>;
	relationshipsLoading: boolean;
	countsLoading: boolean;
}

/**
 * Displays a single relationship as a collapsible key in the JSON explorer.
 * Shows the row count in a badge when collapsed.
 * Lazy-loads related data when expanded.
 */
export const RelationshipExplorerKey = memo(function RelationshipExplorerKey({
	relationship,
	count,
	isExpanded,
	onToggle,
	connectionUrl,
	row,
	relationshipsLoading,
	countsLoading,
}: RelationshipExplorerKeyProps) {
	const [dataLoading, setDataLoading] = useState(false);

	const getKeyLabel = () => {
		const { type, referencingTable, referencedTable } = relationship;
		if (type === "outgoing") {
			return `"${referencingTable} → ${referencedTable}"`;
		}
		return `"${referencingTable} ← ${referencedTable}"`;
	};

	const isLoading = relationshipsLoading || countsLoading || dataLoading;

	return (
		<div className="py-0.5">
			<div className="flex items-center gap-1">
				<button
					onClick={onToggle}
					className="inline-flex items-center p-0 h-4 w-4 hover:bg-muted rounded transition-colors shrink-0"
					aria-label={isExpanded ? "Collapse" : "Expand"}
					disabled={count === 0}
				>
					{isLoading && isExpanded ? (
						<Loader2 size={16} className="animate-spin text-muted-foreground" />
					) : (
						<ChevronDown
							size={16}
							className={cn(
								"transition-transform",
								isExpanded ? "" : "-rotate-90",
								count === 0 ? "opacity-40" : "",
							)}
						/>
					)}
				</button>
				<span className="text-blue-600 dark:text-blue-400">
					{getKeyLabel()}
				</span>
				<span className="text-gray-800 dark:text-gray-200">{`: `}</span>
				{/* Count badge */}
				<span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-muted rounded text-xs font-medium text-muted-foreground">
					{countsLoading ? (
						<Loader2 size={12} className="animate-spin" />
					) : (
						<span>{count}</span>
					)}
					<span>row{count !== 1 ? "s" : ""}</span>
				</span>
				{isExpanded && count === 0 && (
					<span className="text-yellow-600 dark:text-yellow-500 text-xs">
						(no related data)
					</span>
				)}
			</div>

			{/* Expanded content */}
			{isExpanded && count > 0 && (
				<div className="ml-4 mt-1 border-l border-muted pl-3">
					<RelationshipExplorerRows
						relationship={relationship}
						row={row}
						connectionUrl={connectionUrl}
						onLoadingChange={setDataLoading}
					/>
				</div>
			)}
		</div>
	);
});
