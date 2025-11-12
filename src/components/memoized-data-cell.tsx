import type { CellContext } from "@tanstack/react-table";
import { memo } from "react";
import type { ForeignKeyInfo } from "./cell-context-menu";
import { CellContextMenu } from "./cell-context-menu";
import { InlineReferencesButton } from "./inline-references.button.tsx";
import { Badge } from "./ui/badge";
import { JsonCell } from "./ui/json-cell";

export interface MemoizedDataCellProps {
	ctx: CellContext<Record<string, unknown>, unknown>;
	col: {
		name: string;
		dataType: string;
		primaryKey?: boolean;
		unique?: boolean;
		isForeignKey?: boolean;
		foreignKey?: ForeignKeyInfo;
	};
	schema?: string;
	table?: string;
	activeConnectionUrl: string;
	onFollowFK?: (fkInfo: ForeignKeyInfo, cellValue: unknown) => void;
	onFindReferences?: (columnName: string, cellValue: unknown) => void;
	onShowQuickReferences?: () => void;
	onPrefetchReferences: () => void;
	onNavigateToFK?: (fkInfo: ForeignKeyInfo, cellValue: unknown) => void;
	onNavigateToReference?: (
		ref: { schema: string; table: string; column: string },
		cellValue: unknown,
	) => void;
	onExpandToSheet?: () => void;
	onMenuOpen?: () => void;
}

const CellContent = ({
	value,
	fallback,
}: {
	value: unknown;
	fallback: () => any;
}) => {
	if (typeof value === "object" && value !== null) {
		return <JsonCell value={value} />;
	}
	// Handle boolean values with colored badges
	if (typeof value === "boolean") {
		return (
			<Badge colorPalette={value ? "success" : "error"} size="xs">
				{value ? "true" : "false"}
			</Badge>
		);
	}
	// Handle null/undefined with a neutral badge
	if (value === null || value === undefined) {
		return (
			<Badge colorPalette="muted" size="2xs" variant="subtle">
				{value === null ? "NULL" : "undefined"}
			</Badge>
		);
	}

	return fallback();
};

function MemoizedDataCellInner({
	ctx,
	col,
	schema,
	table,
	activeConnectionUrl,
	onFollowFK,
	onFindReferences,
	onShowQuickReferences,
	onPrefetchReferences,
	onNavigateToFK,
	onNavigateToReference,
	onExpandToSheet,
	onMenuOpen,
}: MemoizedDataCellProps) {
	const CellValue = (
		<CellContextMenu
			cellValue={ctx.row.original[col.name]}
			columnName={col.name}
			foreignKey={col.foreignKey}
			primaryKey={col.primaryKey}
			onFollowFK={onFollowFK}
			onFindReferences={onFindReferences}
			onShowQuickReferences={onShowQuickReferences}
			onOpen={onMenuOpen}
		>
			<CellContent value={ctx.getValue()} fallback={() => ctx.renderValue()} />
		</CellContextMenu>
	);

	return (
		<div
			className="group flex gap-1 items-center"
			data-column-content={col.name}
		>
			{table &&
			schema &&
			ctx.row.original[col.name] &&
			(col.foreignKey || col.primaryKey) ? (
				<InlineReferencesButton
					schema={schema}
					table={table}
					columnName={col.name}
					columnDataType={col.dataType}
					reference={col.foreignKey}
					cellValue={ctx.row.original[col.name]}
					connectionUrl={activeConnectionUrl}
					onPrefetchReferences={onPrefetchReferences}
					onNavigateToFK={onNavigateToFK}
					onNavigateToReference={onNavigateToReference}
					onExpandToSheet={onExpandToSheet}
					children={CellValue}
				/>
			) : (
				CellValue
			)}
		</div>
	);
}

export const MemoizedDataCell = memo(
	MemoizedDataCellInner,
	(prevProps, nextProps) => {
		// Custom comparison function for memoization
		// Only re-render if the actual cell value, column definition, or essential props change
		return (
			prevProps.ctx.row.id === nextProps.ctx.row.id &&
			prevProps.ctx.row.original[prevProps.col.name] ===
				nextProps.ctx.row.original[nextProps.col.name] &&
			prevProps.col.name === nextProps.col.name &&
			prevProps.col.dataType === nextProps.col.dataType &&
			prevProps.col.primaryKey === nextProps.col.primaryKey &&
			prevProps.col.foreignKey === nextProps.col.foreignKey &&
			prevProps.schema === nextProps.schema &&
			prevProps.table === nextProps.table &&
			prevProps.activeConnectionUrl === nextProps.activeConnectionUrl
		);
	},
);

MemoizedDataCell.displayName = "MemoizedDataCell";
