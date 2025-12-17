import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { CSSProperties } from "react";
import type {
	FilterConditionExpression,
	LogicalOperatorType,
	QueryFilterType,
} from "#src/components/query-builder/query-filter.ts";
import type { TableColumnMetadata } from "#src/server/introspection/introspection.ts";
import type { JoinConditionMode, JoinedTable } from "./join-tables.types";
import { JoinedTableRow } from "./joined-table-row.tsx";

interface SortableJoinedTableRowProps {
	joined: JoinedTable;
	availableColumns: TableColumnMetadata[];
	parentSchema: string;
	parentTable: string;
	onUpdateType: (type: "left" | "inner") => void;
	onUpdateColumns: (columns: "all" | string[]) => void;
	onUpdateFilters: (filters: QueryFilterType | undefined) => void;
	onUpdateJoinConditionMode: (mode: JoinConditionMode) => void;
	onUpdateCustomJoinConditions: (conditions: string[]) => void;
	onUpdateJoinCondition: (updates: Partial<JoinedTable>) => void;
	onRemove: () => void;
	index: number;
}

export const SortableJoinedTableRow = ({
	joined,
	availableColumns,
	parentSchema,
	parentTable,
	onUpdateType,
	onUpdateColumns,
	onUpdateFilters,
	onUpdateJoinConditionMode,
	onUpdateCustomJoinConditions,
	onUpdateJoinCondition,
	onRemove,
	index,
}: SortableJoinedTableRowProps) => {
	const sortable = useSortable({
		id: `${joined.schema}.${joined.table}`,
	});

	const dragStyle: CSSProperties = {
		opacity: sortable.isDragging ? 0.5 : 1,
		transform: CSS.Translate.toString(sortable.transform),
		transition: "opacity 0.2s ease-in-out",
	};

	return (
		<div
			ref={sortable.setNodeRef}
			style={dragStyle}
			className="relative"
			{...sortable.attributes}
		>
			<div className="flex gap-2">
				<div
					{...sortable.listeners}
					className="flex items-start justify-center pt-4 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors shrink-0"
					title="Drag to reorder"
				>
					<GripVertical className="h-5 w-5" />
				</div>
				<div className="flex-1">
					<JoinedTableRow
						joined={joined}
						availableColumns={availableColumns}
						parentSchema={parentSchema}
						parentTable={parentTable}
						onUpdateType={onUpdateType}
						onUpdateColumns={onUpdateColumns}
						onUpdateFilters={onUpdateFilters}
						onUpdateJoinConditionMode={onUpdateJoinConditionMode}
						onUpdateCustomJoinConditions={onUpdateCustomJoinConditions}
						onUpdateJoinCondition={onUpdateJoinCondition}
						onRemove={onRemove}
					/>
				</div>
			</div>
		</div>
	);
};
