import { Badge } from "./badge";

interface DataTypeBadgeProps {
	dataType: string;
	className?: string;
}

/**
 * Identifies the category of a data type for styling and display
 */
function getDataTypeCategory(dataType: string): {
	category:
		| "id"
		| "timestamp"
		| "numeric"
		| "text"
		| "boolean"
		| "json"
		| "other";
	label: string;
} {
	const normalized = dataType.toLowerCase().trim();

	// ID types
	if (
		normalized === "uuid" ||
		normalized.includes("uuid") ||
		normalized === "int8" ||
		normalized === "bigint"
	) {
		if (normalized === "uuid" || normalized.includes("uuid")) {
			return {
				category: "id",
				label: "UUID",
			};
		}
	}

	// Timestamp types
	if (
		normalized === "timestamp" ||
		normalized === "timestamptz" ||
		normalized === "timestamp without time zone" ||
		normalized === "timestamp with time zone" ||
		normalized === "datetime" ||
		normalized === "date" ||
		normalized === "time" ||
		normalized.includes("timestamp")
	) {
		return {
			category: "timestamp",
			label: "Timestamp",
		};
	}

	// Numeric types
	if (
		normalized === "int2" ||
		normalized === "int4" ||
		normalized === "int8" ||
		normalized === "integer" ||
		normalized === "smallint" ||
		normalized === "bigint" ||
		normalized === "numeric" ||
		normalized === "decimal" ||
		normalized === "real" ||
		normalized === "double precision" ||
		normalized === "float" ||
		normalized === "double"
	) {
		return {
			category: "numeric",
			label: "Numeric",
		};
	}

	// Boolean types
	if (normalized === "boolean" || normalized === "bool") {
		return {
			category: "boolean",
			label: "Boolean",
		};
	}

	// JSON types
	if (
		normalized === "json" ||
		normalized === "jsonb" ||
		normalized.includes("json")
	) {
		return {
			category: "json",
			label: "JSON",
		};
	}

	// Text types
	if (
		normalized === "text" ||
		normalized === "varchar" ||
		normalized.includes("char") ||
		normalized === "string"
	) {
		return {
			category: "text",
			label: "Text",
		};
	}

	// Default
	return {
		category: "other",
		label: "Other",
	};
}

export const DataTypeBadge = ({ dataType, className }: DataTypeBadgeProps) => {
	const typeInfo = getDataTypeCategory(dataType);

	return (
		<Badge
			dataType={typeInfo.category as any}
			size="xs"
			className={className}
			title={dataType}
		>
			{typeInfo.label}
		</Badge>
	);
};

DataTypeBadge.displayName = "DataTypeBadge";
