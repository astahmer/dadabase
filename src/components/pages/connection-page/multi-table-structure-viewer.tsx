import { CheckboxLabel } from "@ark-ui/react";
import { createListCollection } from "@ark-ui/react/combobox";
import { useQuery } from "@tanstack/react-query";
import { Copy, Download } from "lucide-react";
import { useMemo, useState } from "react";
import {
	Menu,
	MenuContent,
	MenuItem,
	MenuSeparator,
	MenuTrigger,
} from "#src/components/ui/menu.tsx";
import { getTablesStructuresQueryOptions } from "#src/server/introspection/start-fns/get-tables-structures.start.ts";
import type { DataTableSize } from "../../data-table/data-table.styles.ts";
import { Button } from "../../ui/button";
import { Checkbox, CheckboxControl } from "../../ui/checkbox";
import {
	Combobox,
	ComboboxContent,
	ComboboxControl,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
	ComboboxTrigger,
} from "../../ui/combobox.tsx";
import { HStack, Stack } from "../../ui/layout.tsx";
import { Spinner } from "../../ui/spinner.tsx";
import { VirtualizerArea } from "../../ui/virtualizer-area.tsx";
import { StructureTable } from "./structure-table.tsx";
import { StructureFilterControls } from "./structure-table-filters.tsx";
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
	const { filters, clearFilters } = useStructureFilters();

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
	const [selectedTables, setSelectedTables] = useState<string[]>([]);
	const [showSelectedOnly, setShowSelectedOnly] = useState(false);

	// Create combobox collection from table names
	const tableCollection = useMemo(() => {
		return createListCollection({
			items: tableStructures
				.filter((t) => t.table.includes(searchFilter))
				.map((t) => ({
					label: t.table,
					value: t.table,
				})),
		});
	}, [tableStructures, searchFilter]);

	// Filter tables by search and selection
	const filteredTables = useMemo(() => {
		let tables = tableStructures;

		// Apply search filter
		if (searchFilter) {
			const lower = searchFilter.toLowerCase();
			tables = tables.filter((t) => t.table.toLowerCase().includes(lower));
		}

		// Apply selected-only filter
		if (showSelectedOnly && selectedTables.length > 0) {
			tables = tables.filter((t) => selectedTables.includes(t.table));
		}

		return tables;
	}, [tableStructures, searchFilter, showSelectedOnly, selectedTables]);

	const getTablesToExport = () => {
		return selectedTables.length > 0
			? filteredTables.filter((t) => selectedTables.includes(t.table))
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
					<Combobox
						collection={tableCollection}
						value={selectedTables}
						onValueChange={(details) => setSelectedTables(details.value)}
						onInputValueChange={(details) =>
							setSearchFilter(details.inputValue)
						}
						multiple
						closeOnSelect={false}
						openOnClick
						allowCustomValue
					>
						<ComboboxControl size="sm">
							<ComboboxInput placeholder="Filter or select tables..." />
							<ComboboxTrigger />
						</ComboboxControl>
						<ComboboxContent>
							<ComboboxList>
								{tableCollection.items.map((item) => (
									<ComboboxItem
										key={item.value}
										item={item}
										className="flex items-center gap-2"
									>
										<Checkbox
											checked={selectedTables.includes(item.value)}
											readOnly
										/>
										<span>{item.label}</span>
									</ComboboxItem>
								))}
							</ComboboxList>
						</ComboboxContent>
					</Combobox>
				</div>

				{/* Selection menu */}
				{filteredTables.length > 0 && selectedTables.length > 0 && (
					<Menu>
						<MenuTrigger asChild>
							<Button variant="outline" size="sm" className="h-8">
								{selectedTables.length} selected
							</Button>
						</MenuTrigger>
						<MenuContent className="z-100">
							<MenuItem
								onClick={() =>
									setSelectedTables(filteredTables.map((t) => t.table))
								}
								value="select-all"
							>
								Select all ({filteredTables.length})
							</MenuItem>
							<MenuItem
								onClick={() => setSelectedTables([])}
								value="deselect-all"
							>
								Clear selection
							</MenuItem>
						</MenuContent>
					</Menu>
				)}

				{/* Show selected only toggle */}
				{selectedTables.length > 0 && (
					<Button
						variant={showSelectedOnly ? "default" : "outline"}
						size="sm"
						onClick={() => setShowSelectedOnly(!showSelectedOnly)}
						className="h-8"
					>
						{showSelectedOnly
							? `Showing ${selectedTables.length} selected`
							: "Show selected only"}
					</Button>
				)}

				{/* <StructureFilterControls /> */}

				{/* Export menu */}
				<Menu>
					<MenuTrigger asChild>
						<Button variant="outline" size="sm" className="h-8 gap-2">
							<Download className="h-4 w-4" />
							Export
						</Button>
					</MenuTrigger>
					<MenuContent className="z-100">
						<MenuItem onClick={handleCopyJSON} value="copy-json">
							<Copy className="h-4 w-4 mr-2" />
							Copy as JSON
						</MenuItem>
						<MenuItem onClick={handleCopyCSV} value="copy-csv">
							<Copy className="h-4 w-4 mr-2" />
							Copy as CSV
						</MenuItem>
						<MenuSeparator />
						<MenuItem onClick={handleExportJSON} value="export-json">
							<Download className="h-4 w-4 mr-2" />
							Download as JSON
						</MenuItem>
						<MenuItem onClick={handleExportCSV} value="export-csv">
							<Download className="h-4 w-4 mr-2" />
							Download as CSV
						</MenuItem>
					</MenuContent>
				</Menu>
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

								const isSelected = selectedTables.includes(
									tableStructure.table,
								);

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
											<div className="flex items-start gap-3 mb-3">
												<Checkbox
													checked={isSelected}
													onCheckedChange={(checked) => {
														const newSelected = checked.checked
															? [...selectedTables, tableStructure.table]
															: selectedTables.filter(
																	(t) => t !== tableStructure.table,
																);
														setSelectedTables(newSelected);
													}}
													className="mt-1"
												>
													<HStack align="center">
														<CheckboxControl />
														<CheckboxLabel>
															<HStack align="center">
																<h3 className="font-semibold text-sm select-text">
																	{tableStructure.table}
																</h3>
																<span className="text-xs text-muted-foreground">
																	({tableStructure.columns.length} columns)
																</span>
															</HStack>
														</CheckboxLabel>
													</HStack>
												</Checkbox>
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
						{selectedTables.length > 0 &&
							` (${selectedTables.length} selected)`}
					</span>
					{selectedTables.length > 0 && (
						<button
							onClick={() => setSelectedTables([])}
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
