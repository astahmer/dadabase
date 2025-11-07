import { cn } from "#src/lib/utils";
import React from "react";

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
	color: string;
} {
	const normalized = dataType.toLowerCase().trim();

	// ID types
	if (
		normalized === "uuid" ||
		normalized.includes("uuid") ||
		normalized === "int8" ||
		normalized === "bigint"
	) {
		if (normalized === "uuid") {
			return {
				category: "id",
				label: "UUID",
				color:
					"bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200",
			};
		}
		if (normalized.includes("uuid")) {
			return {
				category: "id",
				label: "UUID",
				color:
					"bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200",
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
			color: "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200",
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
			color:
				"bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200",
		};
	}

	// Boolean types
	if (normalized === "boolean" || normalized === "bool") {
		return {
			category: "boolean",
			label: "Boolean",
			color:
				"bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-200",
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
			color: "bg-pink-100 dark:bg-pink-900 text-pink-700 dark:text-pink-200",
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
			color:
				"bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200",
		};
	}

	// Default
	return {
		category: "other",
		label: "Other",
		color: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200",
	};
}

export const DataTypeBadge = React.forwardRef<
	HTMLSpanElement,
	DataTypeBadgeProps
>(function DataTypeBadge({ dataType, className }, ref) {
	const typeInfo = getDataTypeCategory(dataType);

	return (
		<span
			ref={ref}
			className={cn(
				"inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
				typeInfo.color,
				className,
			)}
			title={dataType}
		>
			{typeInfo.label}
		</span>
	);
});

DataTypeBadge.displayName = "DataTypeBadge";
