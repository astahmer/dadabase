import type { QueryLogType } from "#src/server/query-logger/query-logger.types.ts";
import { Badge } from "../ui/badge.tsx";

const queryTypeColorMap: Record<
	QueryLogType,
	| "default"
	| "secondary"
	| "destructive"
	| "success"
	| "error"
	| "warning"
	| "info"
	| "muted"
> = {
	table_rows: "default",
	table_count: "info",
	schema_introspection: "warning",
	column_metadata: "destructive",
	foreign_key_lookup: "muted",
	relationship_discovery: "default",
	relationship_cardinality: "success",
	relationship_counting: "error",
};

interface QueryLogTypeBadgeProps {
	type: QueryLogType;
	size?: "xs" | "sm" | "md" | "lg";
}

export const QueryLogTypeBadge = ({
	type,
	size = "xs",
}: QueryLogTypeBadgeProps) => {
	return (
		<Badge colorPalette={queryTypeColorMap[type]} size={size}>
			{type}
		</Badge>
	);
};
