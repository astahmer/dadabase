import { Tooltip } from "./tooltip";
import { DataTypeBadge } from "./data-type-badge";
import type { ReactNode } from "react";
import React from "react";

interface ColumnHeaderWithInfoProps {
	columnName: string;
	dataType: string;
	showBadge?: boolean;
	children?: ReactNode;
	className?: string;
	isPrimaryKey?: boolean;
	isUnique?: boolean;
}

export const ColumnHeaderWithInfo = React.forwardRef<
	HTMLDivElement,
	ColumnHeaderWithInfoProps
>(function ColumnHeaderWithInfo(
	{
		columnName,
		dataType,
		showBadge = true,
		children,
		className,
		isPrimaryKey = false,
		isUnique = false,
	},
	ref,
) {
	// Build tooltip content with data type and constraints
	const tooltipParts = [dataType];
	if (isPrimaryKey) {
		tooltipParts.push("Primary Key");
	}
	if (isUnique) {
		tooltipParts.push("Unique");
	}
	const tooltipContent = tooltipParts.join(" • ");

	return (
		<Tooltip content={tooltipContent} portalled>
			<div
				ref={ref}
				className={`flex items-center gap-2 min-w-0 ${className || ""}`}
			>
				<span className="truncate">{columnName}</span>
				{showBadge && <DataTypeBadge dataType={dataType} />}
				{children}
			</div>
		</Tooltip>
	);
});

ColumnHeaderWithInfo.displayName = "ColumnHeaderWithInfo";
