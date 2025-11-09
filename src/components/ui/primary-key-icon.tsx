import { Key } from "lucide-react";
import React from "react";

interface PrimaryKeyIconProps {
	isPrimaryKey: boolean;
	className?: string;
}

/**
 * Displays a small key icon when a column is a primary key
 */
export const PrimaryKeyIcon = React.forwardRef<
	HTMLDivElement,
	PrimaryKeyIconProps
>(function PrimaryKeyIcon({ isPrimaryKey, className }, ref) {
	if (!isPrimaryKey) {
		return null;
	}

	return (
		<div
			ref={ref}
			className={`inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 ${className || ""}`}
			title="Primary Key"
		>
			<Key className="h-3 w-3" />
		</div>
	);
});

PrimaryKeyIcon.displayName = "PrimaryKeyIcon";
