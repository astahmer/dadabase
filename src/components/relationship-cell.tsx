import { AlertCircle, ChevronDown, Loader2 } from "lucide-react";
import { memo, useState } from "react";
import type { RelationshipMetadata } from "../types/relationships";
import { Button } from "./ui/button";
import { Tooltip } from "./ui/tooltip";

interface RelationshipCellProps {
	relationship: RelationshipMetadata;
	isExpanded: boolean;
	matchingRowCount: number | null;
	isLoadingCount?: boolean;
	onToggleExpand: () => void;
	error?: Error | null;
}

/**
 * Button cell for expanding/collapsing relationship subrows
 * Shows relationship name and count of related rows
 */
export const RelationshipCell = memo(function RelationshipCell({
	relationship,
	isExpanded,
	matchingRowCount,
	isLoadingCount = false,
	onToggleExpand,
	error,
}: RelationshipCellProps) {
	const [isLoading, setIsLoading] = useState(false);

	const handleClick = async () => {
		setIsLoading(true);
		try {
			onToggleExpand();
		} finally {
			setIsLoading(false);
		}
	};

	if (error) {
		return (
			<Tooltip content={error.message}>
				<div className="flex items-center gap-2 text-destructive px-2 py-1">
					<AlertCircle className="h-4 w-4" />
					<span className="text-sm">Error</span>
				</div>
			</Tooltip>
		);
	}

	const isLoaded = matchingRowCount !== null && !isLoadingCount;
	const countText = isLoaded ? `${matchingRowCount} rows` : "...";

	return (
		<Button
			onClick={handleClick}
			variant="outline"
			size="sm"
			className={`flex items-center gap-2 transition-all ${
				isExpanded ? "bg-primary text-primary-foreground border-primary" : ""
			}`}
			// disabled={isLoading || !isLoaded}
		>
			{isLoading ? (
				<Loader2 className="h-3 w-3 animate-spin" />
			) : (
				<ChevronDown
					className={`h-3 w-3 transition-transform ${
						isExpanded ? "rotate-90" : ""
					}`}
				/>
			)}
			<span className="text-xs font-medium">{relationship.displayLabel}</span>
			{isLoaded && (
				<span className="text-xs bg-muted px-2 py-0.5 rounded">
					{countText}
				</span>
			)}
		</Button>
	);
});
