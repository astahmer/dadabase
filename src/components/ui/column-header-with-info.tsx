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
}

export const ColumnHeaderWithInfo = React.forwardRef<
	HTMLDivElement,
	ColumnHeaderWithInfoProps
>(function ColumnHeaderWithInfo(
	{ columnName, dataType, showBadge = true, children, className },
	ref,
) {
	return (
		<Tooltip content={dataType} portalled>
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
