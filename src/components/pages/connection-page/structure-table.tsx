import type { ColumnDef } from "@tanstack/react-table";
import { DataTypeBadge } from "../../app/data-type-badge.tsx";
import { PrimaryKeyIcon } from "../../app/primary-key-icon.tsx";
import { UniqueConstraintIcon } from "../../app/unique-constraint-icon.tsx";
import type { DataTableSize } from "../../data-table/data-table.styles.ts";
import { DataTable } from "../../data-table/data-table.tsx";
import { useDataTable } from "../../data-table/use-data-table.ts";
import { HStack } from "../../ui/layout.tsx";

interface StructureTableProps {
	columnMetadata: Array<{
		name: string;
		dataType: string;
		nullable: boolean;
		primaryKey: boolean;
		unique: boolean;
		defaultValue: string | null;
		isForeignKey?: boolean;
		foreignKey?: {
			referencedSchema: string;
			referencedTable: string;
			referencedColumn: string;
		};
	}>;
	isLoading: boolean;
	tableSize: DataTableSize;
}

export const StructureTable = (props: StructureTableProps) => {
	const { columnMetadata } = props;

	const structureColumns: Array<ColumnDef<(typeof columnMetadata)[number]>> = [
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
				<span className="text-xs">
					{info.getValue<boolean>() ? "Yes" : "No"}
				</span>
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
						{fk.referencedSchema}.{fk.referencedTable}.{fk.referencedColumn}
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

	const structureTable = useDataTable({
		data: columnMetadata,
		columns: structureColumns,
		manualPagination: true,
		rowCount: columnMetadata.length,
	});

	return (
		<DataTable
			table={structureTable}
			isLoading={props.isLoading}
			size={props.tableSize}
		/>
	);
};
