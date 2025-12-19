import { getTablesStructuresQueryOptions } from "#src/server/introspection/start-fns/get-tables-structures.start.ts";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { useMemo, useState } from "react";
import type { DataTableSize } from "../../data-table/data-table.styles.ts";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { HStack, Stack } from "../../ui/layout.tsx";
import { Spinner } from "../../ui/spinner.tsx";
import { VirtualizerArea } from "../../ui/virtualizer-area.tsx";
import { StructureFilterControls } from "./structure-table-filters.tsx";
import { StructureTable } from "./structure-table.tsx";
import { useStructureFilters } from "./use-structure-filter-state.ts";

interface MultiTableStructureViewerProps {
	activeConnectionUrl: string;
	schema: string;
	tableSize: DataTableSize;
}

export const MultiTableStructureViewer = (
	props: MultiTableStructureViewerProps,
) => {
	const { activeConnectionUrl, schema, tableSize } = props;
	const { filters } = useStructureFilters();

	// Fetch all table structures
	const tablesStructuresQuery = useQuery({
		...getTablesStructuresQueryOptions({
			url: activeConnectionUrl,
			schema,
		}),
		retry: 2,
	});

	const tableStructures = tablesStructuresQuery.data || [];
	const [searchFilter, setSearchFilter] = useState("");

	// Filter tables by search
	const filteredTables = useMemo(() => {
		if (!searchFilter) return tableStructures;
		const lower = searchFilter.toLowerCase();
		return tableStructures.filter((t) => t.table.toLowerCase().includes(lower));
	}, [tableStructures, searchFilter]);

	// Measure actual DOM heights for accurate virtualization
	const measureElement = (element: HTMLElement) => {
		return element?.getBoundingClientRect().height ?? 300;
	};

	const handleExportJSON = () => {
		const data = {
			schema,
			exportedAt: new Date().toISOString(),
			tables: filteredTables.map((table) => ({
				name: table.table,
				columns: table.columns,
			})),
		};

		const json = JSON.stringify(data, null, 2);
		const blob = new Blob([json], { type: "application/json" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `${schema}-structure-${Date.now()}.json`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	};

	const handleExportCSV = () => {
		const rows: string[] = [];
		rows.push(
			"Table,Column Name,Data Type,Nullable,Primary Key,Unique,Default Value,Foreign Key",
		);

		for (const table of filteredTables) {
			for (const col of table.columns) {
				const fkRef = col.foreignKey
					? `${col.foreignKey.referencedSchema}.${col.foreignKey.referencedTable}.${col.foreignKey.referencedColumn}`
					: "";
				const row = [
					`"${table.table}"`,
					`"${col.name}"`,
					`"${col.dataType}"`,
					col.nullable ? "Yes" : "No",
					col.primaryKey ? "Yes" : "No",
					col.unique ? "Yes" : "No",
					`"${col.defaultValue ?? ""}"`,
					`"${fkRef}"`,
				];
				rows.push(row.join(","));
			}
		}

		const csv = rows.join("\n");
		const blob = new Blob([csv], { type: "text/csv" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `${schema}-structure-${Date.now()}.csv`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
	};

	return (
		<div className="h-full gap-4 p-4 flex flex-col">
			{/* Header with search and filters */}
			<HStack className="gap-2 items-end">
				<div className="flex-1">
					<label className="text-sm text-muted-foreground mb-1 block">
						Search tables
					</label>
					<Input
						placeholder="Find tables..."
						value={searchFilter}
						onChange={(e) => setSearchFilter(e.target.value)}
						className="text-sm h-8"
					/>
				</div>

				<HStack className="gap-2">
					<StructureFilterControls />

					{/* Export buttons */}
					<Button
						variant="outline"
						size="sm"
						onClick={handleExportJSON}
						className="h-8 gap-2"
					>
						<Download className="h-4 w-4" />
						JSON
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={handleExportCSV}
						className="h-8 gap-2"
					>
						<Download className="h-4 w-4" />
						CSV
					</Button>
				</HStack>
			</HStack>

			{/* Tables list */}
			{tablesStructuresQuery.isLoading ? (
				<Stack className="flex-1 flex items-center justify-center">
					<Spinner />
					<span className="text-muted-foreground text-sm">
						Loading table structures...
					</span>
				</Stack>
			) : tablesStructuresQuery.isError ? (
				<div className="text-destructive text-sm p-4 bg-destructive/10 rounded">
					Failed to load table structures. Please try again.
				</div>
			) : filteredTables.length === 0 ? (
				<div className="text-muted-foreground text-sm text-center py-8">
					{searchFilter
						? "No tables match your search"
						: "No tables found in this schema"}
				</div>
			) : (
				<VirtualizerArea
					count={filteredTables.length}
					className="flex-1 overflow-auto border border-border rounded-md"
					virtualizerOptions={{
						estimateSize: () => 300, // Initial estimate, will be replaced by measured heights
						measureElement: measureElement,
						overscan: 3,
					}}
				>
					{({ virtualItems, totalSize, paddingTop, paddingBottom }) => (
						<div style={{ height: `${totalSize}px` }} className="relative">
							{/* Padding for virtualizer */}
							{paddingTop > 0 && <div style={{ height: `${paddingTop}px` }} />}

							{virtualItems.map((virtualItem) => {
								const tableStructure = filteredTables[virtualItem.index];
								if (!tableStructure) return null;

								return (
									<div
										key={virtualItem.key}
										className="p-4"
										data-virtualizer-index={virtualItem.index}
									>
										<div className="border border-border rounded-lg p-4 bg-card">
											<h3 className="font-semibold text-sm mb-3">
												{tableStructure.table}
												<span className="text-xs text-muted-foreground ml-2">
													({tableStructure.columns.length} columns)
												</span>
											</h3>
											<div className="overflow-auto">
												<StructureTable
													columnMetadata={tableStructure.columns}
													isLoading={false}
													tableSize={tableSize}
													filters={filters}
												/>
											</div>
										</div>
									</div>
								);
							})}

							{/* Padding for virtualizer */}
							{paddingBottom > 0 && (
								<div style={{ height: `${paddingBottom}px` }} />
							)}
						</div>
					)}
				</VirtualizerArea>
			)}

			{/* Summary */}
			{!tablesStructuresQuery.isLoading && (
				<div className="text-xs text-muted-foreground">
					Showing {filteredTables.length} of {tableStructures.length} table
					{tableStructures.length !== 1 ? "s" : ""}
				</div>
			)}
		</div>
	);
};
