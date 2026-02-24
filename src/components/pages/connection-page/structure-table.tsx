import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import type { TableColumnMetadata } from "#src/server/introspection/introspection.ts";
import { DataTypeBadge } from "../../app/data-type-badge.tsx";
import { PrimaryKeyIcon } from "../../app/primary-key-icon.tsx";
import { UniqueConstraintIcon } from "../../app/unique-constraint-icon.tsx";
import type { DataTableSize } from "../../data-table/data-table.styles.ts";
import { DataTable } from "../../data-table/data-table.tsx";
import { useDataTable } from "../../data-table/use-data-table.ts";
import { HStack } from "../../ui/layout.tsx";
import type { StructureFilters } from "./use-structure-filter-state.ts";

interface StructureTableProps {
	columnMetadata: Array<TableColumnMetadata>;
	isLoading: boolean;
	tableSize: DataTableSize;
	filters?: StructureFilters;
}

const filterColumnMetadata = (
	columns: StructureTableProps["columnMetadata"],
	filters: StructureFilters | undefined,
): StructureTableProps["columnMetadata"] => {
	if (!filters) return columns;

	return columns.filter((col) => {
		// Search filter (case-insensitive)
		if (filters.search) {
			const searchLower = filters.search.toLowerCase();
			const matchesSearch =
				col.name.toLowerCase().includes(searchLower) ||
				col.dataType.toLowerCase().includes(searchLower) ||
				(col.foreignKey &&
					`${col.foreignKey.referencedSchema}.${col.foreignKey.referencedTable}.${col.foreignKey.referencedColumn}`
						.toLowerCase()
						.includes(searchLower));

			if (!matchesSearch) return false;
		}

		// Nullable filter
		if (filters.nullable && !col.nullable) return false;

		// Primary Key filter
		if (filters.primaryKey && !col.primaryKey) return false;

		// Unique filter
		if (filters.unique && !col.unique) return false;

		// Foreign Key filter
		if (filters.foreignKey && !col.isForeignKey) return false;

		// Has Defaults filter
		if (filters.hasDefaults && !col.defaultValue) return false;

		return true;
	});
};

export const StructureTable = (props: StructureTableProps) => {
	const { columnMetadata, filters } = props;

	const filteredMetadata = useMemo(
		() => filterColumnMetadata(columnMetadata, filters),
		[columnMetadata, filters],
	);

	const structureTable = useDataTable({
		data: filteredMetadata,
		columns: structureColumns,
		getRowId: (row) => row.name,
	});

	return (
		<DataTable
			table={structureTable}
			isLoading={props.isLoading}
			size={props.tableSize}
			enableColumnOrdering={false}
			enableRowVirtualization
			enableColumnVirtualization
		/>
	);
};

const structureColumns: Array<ColumnDef<any>> = [
	{
		accessorKey: "name",
		header: "Name",
		enableResizing: true,
	},
	{
		accessorKey: "dataType",
		header: "Data Type",
		size: 120,
		minSize: 80,
		maxSize: 200,
		enableResizing: true,
		cell: (info) => (
			<div className="flex items-center gap-2">
				<DataTypeBadge dataType={info.getValue<string>()} />
				<span className="text-xs font-mono text-muted-foreground">
					{info.getValue<string>()}
				</span>
			</div>
		),
	},
	{
		accessorKey: "nullable",
		header: "Nullable",
		enableResizing: true,
		cell: (info) => (
			<span className="text-xs">{info.getValue<boolean>() ? "Yes" : "No"}</span>
		),
	},
	{
		accessorKey: "primaryKey",
		header: "Primary Key",
		enableResizing: true,
		cell: (info) => (
			<HStack className="text-xs">
				{info.getValue<boolean>() ? "Yes" : "No"}
				<PrimaryKeyIcon isPrimaryKey={info.getValue<boolean>()} />
			</HStack>
		),
	},
	{
		accessorKey: "unique",
		header: "Unique",
		enableResizing: true,
		cell: (info) => (
			<HStack className="text-xs">
				{info.getValue<boolean>() ? "Yes" : "No"}
				<UniqueConstraintIcon isUnique={info.getValue<boolean>()} />
			</HStack>
		),
	},
	{
		id: "foreignKey",
		header: "Foreign Key",
		enableResizing: true,
		cell: (info) => {
			const row = info.row.original;
			if (!row.isForeignKey || !row.foreignKey) {
				return <span className="text-xs text-muted-foreground">—</span>;
			}
			const fk = row.foreignKey;
			return (
				<span className="text-xs font-mono">
					{fk.referencedSchema ? `${fk.referencedSchema}.` : ""}
					{fk.referencedTable}.{fk.referencedColumn}
				</span>
			);
		},
	},
	{
		accessorKey: "defaultValue",
		header: "Default Value",
		enableResizing: true,
		cell: (info) => {
			const value = info.getValue<string | null>();
			return <span className="text-xs font-mono">{value ? value : "—"}</span>;
		},
	},
];
