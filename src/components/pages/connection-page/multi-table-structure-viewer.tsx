import { getTablesStructuresQueryOptions } from "#src/server/introspection/start-fns/get-tables-structures.start.ts";
import { useQuery } from "@tanstack/react-query";
import { Copy, Download } from "lucide-react";
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
import {
	Menu,
	MenuContent,
	MenuItem,
	MenuSeparator,
	MenuTrigger,
} from "#src/components/ui/menu.tsx";

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
	const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());

	// Filter tables by search
	const filteredTables = useMemo(() => {
		if (!searchFilter) return tableStructures;
		const lower = searchFilter.toLowerCase();
		return tableStructures.filter((t) => t.table.toLowerCase().includes(lower));
	}, [tableStructures, searchFilter]);

	const getTablesToExport = () => {
		return selectedTables.size > 0
			? filteredTables.filter((t) => selectedTables.has(t.table))
			: filteredTables;
	};

	// Measure actual DOM heights for accurate virtualization
	const measureElement = (element: HTMLElement) => {
		return element?.getBoundingClientRect().height ?? 300;
	};

	const handleExportJSON = () => {
		const tablesToExport = getTablesToExport();
		const data = {
			schema,
			exportedAt: new Date().toISOString(),
			tables: tablesToExport.map((table) => ({
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

	const handleCopyJSON = () => {
		const tablesToExport = getTablesToExport();
		const data = {
			schema,
			exportedAt: new Date().toISOString(),
			tables: tablesToExport.map((table) => ({
				name: table.table,
				columns: table.columns,
			})),
		};

		const json = JSON.stringify(data, null, 2);
		navigator.clipboard.writeText(json);
	};

	const handleExportCSV = () => {
		const tablesToExport = getTablesToExport();
		const rows: string[] = [];
		rows.push(
			"Table,Column Name,Data Type,Nullable,Primary Key,Unique,Default Value,Foreign Key",
		);

		for (const table of tablesToExport) {
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

	const handleCopyCSV = () => {
		const tablesToExport = getTablesToExport();
		const rows: string[] = [];
		rows.push(
			"Table,Column Name,Data Type,Nullable,Primary Key,Unique,Default Value,Foreign Key",
		);

		for (const table of tablesToExport) {
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
		navigator.clipboard.writeText(csv);
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

					{/* Export menu */}
					<Menu>
						<MenuTrigger asChild>
							<Button variant="outline" size="sm" className="h-8 gap-2">
								<Download className="h-4 w-4" />
								Export
							</Button>
						</MenuTrigger>
						<MenuContent>
							<MenuItem onClick={handleExportJSON} value="export-json">
								<Download className="h-4 w-4 mr-2" />
								Download as JSON
							</MenuItem>
							<MenuItem onClick={handleExportCSV} value="export-csv">
								<Download className="h-4 w-4 mr-2" />
								Download as CSV
							</MenuItem>
							<MenuSeparator />
							<MenuItem onClick={handleCopyJSON} value="copy-json">
								<Copy className="h-4 w-4 mr-2" />
								Copy as JSON
							</MenuItem>
							<MenuItem onClick={handleCopyCSV} value="copy-csv">
								<Copy className="h-4 w-4 mr-2" />
								Copy as CSV
							</MenuItem>
						</MenuContent>
					</Menu>
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

								const isSelected = selectedTables.has(tableStructure.table);

								return (
									<div
										key={virtualItem.key}
										className="p-4"
										data-virtualizer-index={virtualItem.index}
									>
										<div
											className={`border rounded-lg p-4 transition-colors ${
												isSelected
													? "border-primary bg-primary/5"
													: "border-border bg-card"
											}`}
										>
											<div className="flex items-center gap-3 flex-1 mb-3">
												<input
													type="checkbox"
													checked={isSelected}
													onChange={(e) => {
														const newSelected = new Set(selectedTables);
														if (e.target.checked) {
															newSelected.add(tableStructure.table);
														} else {
															newSelected.delete(tableStructure.table);
														}
														setSelectedTables(newSelected);
													}}
													className="mt-1"
												/>
												<HStack align="center">
													<h3 className="font-semibold text-sm">
														{tableStructure.table}
													</h3>
													<span className="text-xs text-muted-foreground">
														({tableStructure.columns.length} columns)
													</span>
												</HStack>
											</div>
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

			{/* Summary with selection info */}
			{!tablesStructuresQuery.isLoading && (
				<div className="text-xs text-muted-foreground flex items-center justify-between">
					<span>
						Showing {filteredTables.length} of {tableStructures.length} table
						{tableStructures.length !== 1 ? "s" : ""}
						{selectedTables.size > 0 && ` (${selectedTables.size} selected)`}
					</span>
					{selectedTables.size > 0 && (
						<button
							onClick={() => setSelectedTables(new Set())}
							className="text-xs text-muted-foreground hover:text-foreground underline"
						>
							Clear selection
						</button>
					)}
				</div>
			)}
		</div>
	);
};
