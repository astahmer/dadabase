import { Link } from "lucide-react";
import React from "react";

interface ForeignKeyIconProps {
	isForeignKey: boolean;
	className?: string;
}

/**
 * Displays a link icon when a column is a foreign key
 */
export const ForeignKeyIcon = React.forwardRef<
	HTMLDivElement,
	ForeignKeyIconProps
>(function ForeignKeyIcon({ isForeignKey, className }, ref) {
	if (!isForeignKey) {
		return null;
	}

	return (
		<div
			ref={ref}
			className={`inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 ${className || ""}`}
			title="Foreign Key"
		>
			<Link className="h-3 w-3" />
		</div>
	);
});

ForeignKeyIcon.displayName = "ForeignKeyIcon";
