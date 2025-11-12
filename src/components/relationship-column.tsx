import type { ColumnDef } from "@tanstack/react-table";
import type {
	RelationshipMetadata,
	RowRelationshipExpansionState,
} from "../types/relationships";
import { RelationshipCell } from "./relationship-cell";
import { RelationshipSubrowTable } from "./relationship-subrow-table";

/**
 * Builds ColumnDef objects for each relationship
 * Returns columns that display relationship buttons and subrows
 *
 * Note: The actual expand/collapse state and row counts are managed by the parent component
 * via expandedRelationships state and rendering of subrows in DataTableRow
 */
export function buildRelationshipColumns(
	relationships: RelationshipMetadata[],
	expandedRelationships: RowRelationshipExpansionState,
	onToggleRelationship: (rowId: string, constraintName: string) => void,
	rowCountsByRelationship?: Map<string, Map<string, number>>,
): ColumnDef<Record<string, unknown>>[] {
	return relationships.map((relationship) => ({
		id: `relationship-${relationship.constraintName}`,
		header: () => (
			<div className="text-xs font-medium text-foreground">
				{relationship.displayLabel}
			</div>
		),
		cell: (ctx) => {
			const rowId = String(ctx.row.original.id ?? ctx.row.index);
			const isExpanded =
				expandedRelationships[rowId]?.has(relationship.constraintName) ?? false;

			const matchingRowCount =
				rowCountsByRelationship?.get(relationship.constraintName)?.get(rowId) ??
				null;

			return (
				<RelationshipCell
					relationship={relationship}
					isExpanded={isExpanded}
					matchingRowCount={matchingRowCount}
					onToggleExpand={() =>
						onToggleRelationship(rowId, relationship.constraintName)
					}
				/>
			);
		},
		meta: {
			enableColumnOrdering: false,
		},
		size: 120,
		minSize: 100,
		maxSize: 150,
		enableResizing: true,
		enableSorting: false,
		enablePinning: false,
	})) as ColumnDef<Record<string, unknown>>[];
}

/**
 * Creates a wrapper component for rendering relationship subrows
 * This component is passed to DataTableRow to render expanded relationships
 */
export function createRelationshipSubrowComponent(connection: { url: string }) {
	return function RelationshipSubrowComponent({
		relationship,
		parentRowValue,
	}: {
		relationship: RelationshipMetadata;
		parentRowValue: unknown;
	}) {
		return (
			<RelationshipSubrowTable
				relationship={relationship}
				parentRowValue={parentRowValue}
				connection={connection}
			/>
		);
	};
}
