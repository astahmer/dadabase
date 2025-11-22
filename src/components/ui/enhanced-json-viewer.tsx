import { memo } from "react";
import { RelationshipExplorer } from "#src/components/relationship-explorer";
import { JsonViewer } from "#src/components/ui/json-viewer";

interface EnhancedJsonViewerProps {
	data: unknown;
	/** Optional: Enable relationship explorer mode */
	showRelationships?: boolean;
	/** Optional: Current schema for relationship queries */
	schema?: string;
	/** Optional: Current table for relationship queries */
	table?: string;
	/** Optional: Connection URL for relationship queries */
	connectionUrl?: string;
	className?: string;
	defaultExpanded?: boolean;
	maxDepth?: number;
}

/**
 * Enhanced JSON viewer that can display relationships.
 * Falls back to regular JSON viewer if relationships are not enabled.
 */
export const EnhancedJsonViewer = memo(function EnhancedJsonViewer({
	data,
	showRelationships = false,
	schema,
	table,
	connectionUrl,
	className,
	defaultExpanded = false,
	maxDepth = 10,
}: EnhancedJsonViewerProps) {
	// Use relationship explorer if requested and we have required data and value is an object
	const useRelationshipExplorer =
		showRelationships &&
		schema &&
		table &&
		connectionUrl &&
		typeof data === "object" &&
		data !== null;

	if (useRelationshipExplorer) {
		return (
			<RelationshipExplorer
				row={data as Record<string, unknown>}
				schema={schema}
				table={table}
				connectionUrl={connectionUrl}
				className={className}
				maxDepth={Math.max(maxDepth - 1, 2)}
				showRelationships={true}
			/>
		);
	}

	return (
		<JsonViewer
			data={data}
			defaultExpanded={defaultExpanded}
			maxDepth={maxDepth}
			className={className}
		/>
	);
});
