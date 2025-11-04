import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { useConnectionStorage } from "#src/hooks/use-connection-storage";
import { listDbConnectionQueryOptions } from "#src/server/db-connection/start-fns/list-db-connection.start.ts";
import { listAvailableSchemasQueryOptions } from "#src/server/pg/start-fns/get-available-schemas.start";
import { listAvailableTablesQueryOptions } from "#src/server/pg/start-fns/get-available-tables.start";
import { queryTableDataQueryOptions } from "#src/server/pg/start-fns/query-table-data.start";
import { DataTable } from "../data-table";
import { useDataTable } from "../use-data-table";
import * as ArkSelect from "../ui/select";

interface ConnectionPageProps {
	connectionName: string;
}

export const ConnectionPage = ({ connectionName }: ConnectionPageProps) => {
	const connections = useSuspenseQuery(listDbConnectionQueryOptions);
	const connection = connections.data.find((c) => c.name === connectionName);

	const {
		schema: savedSchema,
		setSchema,
		table: savedTable,
		setTable,
	} = useConnectionStorage(connectionName);

	const [selectedSchema, setSelectedSchema] = useState<string | undefined>(
		savedSchema || "public",
	);
	const [selectedTable, setSelectedTable] = useState<string | undefined>(
		savedTable,
	);

	// Get schemas
	const schemasQuery = useQuery({
		...listAvailableSchemasQueryOptions({ url: connection?.url || "" }),
		enabled: !!connection?.url,
	});

	// Get tables
	const tablesQuery = useQuery({
		...listAvailableTablesQueryOptions({
			url: connection?.url || "",
			schema: selectedSchema || "",
		}),
		enabled: !!connection?.url && !!selectedSchema,
	});

	// Get table data
	const tableDataQuery = useQuery({
		...queryTableDataQueryOptions({
			url: connection?.url || "",
			schema: selectedSchema || "",
			table: selectedTable || "",
			limit: 50,
		}),
		enabled: !!connection?.url && !!selectedSchema && !!selectedTable,
	});

	const schemas = (schemasQuery.data || []) as string[];
	const tables = (tablesQuery.data || []) as any[];
	const tableData = (tableDataQuery.data || []) as Record<string, any>[];
	console.log({ schemas, tables, tableData });

	const tableDisplayName = selectedTable
		? `${selectedSchema}.${selectedTable}`
		: "No table selected";

	const columns = useMemo(() => {
		if (!tableData || tableData.length === 0) {
			return [];
		}

		const firstRow = tableData[0];
		return Object.keys(firstRow).map((key) => ({
			accessorKey: key,
			header: key,
		}));
	}, [tableData]);

	const dataTable = useDataTable({
		data: tableData,
		columns,
	});

	if (!connection) {
		return (
			<div className="min-h-screen bg-background py-8 px-4">
				<div className="max-w-6xl mx-auto">
					<h1 className="text-2xl font-bold text-foreground">
						Connection not found
					</h1>
				</div>
			</div>
		);
	}

	const schemaCollection = ArkSelect.createListCollection({
		items: schemas.map((s: string) => ({ label: s, value: s })),
	});

	const tableCollection = ArkSelect.createListCollection({
		items: tables.map((t: any) => ({
			label: t.name,
			value: t.name,
		})),
	});

	return (
		<div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8">
			<div className="max-w-6xl mx-auto">
				{/* Header */}
				<div className="mb-8">
					<h1 className="text-4xl font-bold tracking-tight text-foreground">
						{connection.name}
					</h1>
					<p className="text-muted-foreground mt-2">{connection.url}</p>
				</div>

				{/* Selectors */}
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
					{/* Schema Selector */}
					<div className="space-y-2">
						<label className="text-sm font-medium text-foreground">
							Schema
						</label>
						{schemasQuery.isLoading ? (
							<div className="flex items-center justify-between rounded-md border border-input bg-card px-3 py-2 min-h-[38px]">
								<span className="text-sm text-muted-foreground">
									Loading schemas...
								</span>
							</div>
						) : (
							<ArkSelect.Select
								className="w-full"
								value={selectedSchema ? [selectedSchema] : []}
								collection={schemaCollection}
								positioning={{ sameWidth: true }}
								disabled={schemasQuery.isLoading}
								onValueChange={(details: any) => {
									const newSchema = details.value?.[0];
									if (newSchema) {
										setSelectedSchema(newSchema);
										setSchema(newSchema);
										setSelectedTable(undefined);
										// setTable is only for string values
									}
								}}
							>
								<ArkSelect.SelectControl>
									<ArkSelect.SelectTrigger>
										<ArkSelect.SelectValueText placeholder="Select a schema" />
										<ArkSelect.SelectIndicator />
									</ArkSelect.SelectTrigger>
								</ArkSelect.SelectControl>
								<ArkSelect.SelectContent>
									{schemaCollection.items.map((item: any) => (
										<ArkSelect.SelectItem key={item.value} item={item}>
											{item.label}
										</ArkSelect.SelectItem>
									))}
								</ArkSelect.SelectContent>
							</ArkSelect.Select>
						)}
					</div>

					{/* Table Selector */}
					<div className="space-y-2">
						<label className="text-sm font-medium text-foreground">Table</label>
						{tablesQuery.isLoading ? (
							<div className="flex items-center justify-between rounded-md border border-input bg-card px-3 py-2 min-h-[38px]">
								<span className="text-sm text-muted-foreground">
									Loading tables...
								</span>
							</div>
						) : (
							<ArkSelect.Select
								className="w-full"
								value={selectedTable ? [selectedTable] : []}
								collection={tableCollection}
								positioning={{ sameWidth: true }}
								disabled={!selectedSchema || tablesQuery.isLoading}
								onValueChange={(details: any) => {
									const newTable = details.value?.[0];
									if (newTable) {
										setSelectedTable(newTable);
										setTable(newTable);
									}
								}}
							>
								<ArkSelect.SelectControl>
									<ArkSelect.SelectTrigger>
										<ArkSelect.SelectValueText placeholder="Select a table" />
										<ArkSelect.SelectIndicator />
									</ArkSelect.SelectTrigger>
								</ArkSelect.SelectControl>
								<ArkSelect.SelectContent>
									{tableCollection.items.map((item: any) => (
										<ArkSelect.SelectItem key={item.value} item={item}>
											{item.label}
										</ArkSelect.SelectItem>
									))}
								</ArkSelect.SelectContent>
							</ArkSelect.Select>
						)}
					</div>

					{/* Info */}
					<div className="space-y-2">
						<label className="text-sm font-medium text-foreground">
							Current Table
						</label>
						<div className="flex items-center justify-between rounded-md border border-input bg-card px-3 py-2">
							<span className="text-sm text-muted-foreground truncate">
								{tableDisplayName}
							</span>
						</div>
					</div>
				</div>

				{/* Data Table */}
				{selectedTable && selectedSchema ? (
					<div className="rounded-lg border bg-card shadow-sm overflow-hidden">
						<div className="px-4 py-4 border-b bg-muted/50">
							<h2 className="text-lg font-semibold text-foreground">
								Table Data - First 50 rows
							</h2>
							<p className="text-sm text-muted-foreground mt-1">
								{tableDataQuery.isLoading
									? "Loading data..."
									: `Showing ${tableData.length || 0} rows from ${tableDisplayName}`}
							</p>
						</div>
						{tableDataQuery.isLoading ? (
							<div className="px-4 py-8 text-center">
								<p className="text-muted-foreground">Loading table data...</p>
							</div>
						) : tableDataQuery.isError ? (
							<div className="px-4 py-8 text-center">
								<p className="text-destructive">
									Error loading table data. Please try again.
								</p>
							</div>
						) : (
							<div className="overflow-x-auto">
								<DataTable table={dataTable} />
							</div>
						)}
					</div>
				) : (
					<div className="rounded-lg border border-dashed bg-muted/50 p-12 text-center">
						<p className="text-muted-foreground">
							Select a schema and table to view the data
						</p>
					</div>
				)}
			</div>
		</div>
	);
};
