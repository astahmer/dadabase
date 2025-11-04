import {
	useQuery,
	useSuspenseQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";
import { useConnectionStorage } from "#src/hooks/use-connection-storage";
import { listDbConnectionQueryOptions } from "#src/server/db-connection/start-fns/list-db-connection.start.ts";
import { listAvailableDatabase } from "#src/server/pg/start-fns/get-available-database-list.start";
import { listAvailableSchemasQueryOptions } from "#src/server/pg/start-fns/get-available-schemas.start";
import { listAvailableTablesQueryOptions } from "#src/server/pg/start-fns/get-available-tables.start";
import { queryTableDataQueryOptions } from "#src/server/pg/start-fns/query-table-data.start";
import { redactConnectionUrl } from "#src/lib/redact-connection-url";
import { DataTable } from "../data-table";
import { useDataTable } from "../use-data-table";
import * as ArkSelect from "../ui/select";
import { Button } from "../ui/button";
import { RefreshCw } from "lucide-react";

const formatRelativeTime = (timestamp: number): string => {
	const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
	const now = Date.now();
	const seconds = Math.floor((now - timestamp) / 1000);

	if (seconds < 60) return rtf.format(-seconds, "second");
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return rtf.format(-minutes, "minute");
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return rtf.format(-hours, "hour");
	const days = Math.floor(hours / 24);
	return rtf.format(-days, "day");
};

interface ConnectionPageProps {
	connectionName: string;
}

export const ConnectionPage = ({ connectionName }: ConnectionPageProps) => {
	const queryClient = useQueryClient();
	const connections = useSuspenseQuery(listDbConnectionQueryOptions);
	const connection = connections.data.find((c) => c.name === connectionName);

	const {
		database: savedDatabase,
		setDatabase,
		schema: savedSchema,
		setSchema,
		table: savedTable,
		setTable,
	} = useConnectionStorage(connectionName);

	const [selectedDatabase, setSelectedDatabase] = useState<string | undefined>(
		savedDatabase,
	);
	const [selectedSchema, setSelectedSchema] = useState<string | undefined>(
		savedSchema || "public",
	);
	const [selectedTable, setSelectedTable] = useState<string | undefined>(
		savedTable,
	);
	const [showTableStructure, setShowTableStructure] = useState(false);

	// Get databases
	const databasesQuery = useQuery({
		...listAvailableDatabase({ url: connection?.url || "" }),
		enabled: !!connection?.url,
	});

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
	const queryResponse = (tableDataQuery.data || { rows: [], timeTaken: 0, ranAt: 0 }) as { rows: Record<string, any>[]; timeTaken: number; ranAt: number };
	const tableData = queryResponse.rows;

	const tableDisplayName = selectedTable
		? `${selectedSchema}.${selectedTable}`
		: "No table selected";

	const columns = tableData && tableData.length > 0
		? Object.keys(tableData[0]).map((key) => ({
				accessorKey: key,
				header: key,
				size: 150,
			}))
		: [];

	const dataTable = useDataTable({
		data: tableData,
		columns,
	});

	const redactedUrl = connection ? redactConnectionUrl(connection.url) : "";

	if (!connection) {
		return (
			<div className="h-screen bg-background py-8 px-4">
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

	const databases = (databasesQuery.data || []) as { datname: string }[];
	const databaseCollection = ArkSelect.createListCollection({
		items: databases.map((d) => ({ label: d.datname, value: d.datname })),
	});

	return (
		<div className="h-screen bg-background flex flex-col">
			{/* Header */}
			<div className="border-b bg-card px-4 py-3 sm:px-6 space-y-2">
				<div className="flex items-center justify-between gap-4">
					<div className="flex-1 min-w-0">
						<h1 className="text-2xl font-bold tracking-tight text-foreground truncate">
							{connection.name}
						</h1>
						<p className="text-sm text-muted-foreground truncate mt-1">
							{redactedUrl}
						</p>
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={() => {
							queryClient.invalidateQueries({
								queryKey: ["db", "list"],
							});
							queryClient.invalidateQueries({
								queryKey: ["pg", "dbList"],
							});
							queryClient.invalidateQueries({
								queryKey: ["pg", "schemaList"],
							});
							queryClient.invalidateQueries({
								queryKey: ["pg", "tableList"],
							});
							queryClient.invalidateQueries({
								queryKey: ["pg", "tableData"],
							});
						}}
						className="shrink-0"
					>
						<RefreshCw className="h-4 w-4" />
					</Button>
				</div>
				{/* Database Selector */}
				<div className="flex items-center gap-2">
					<label className="text-xs font-medium text-foreground uppercase tracking-wide whitespace-nowrap">
						Database:
					</label>
					{databasesQuery.isLoading ? (
						<div className="h-9 rounded-md border border-input bg-card px-3 py-2 min-w-32 flex items-center">
							<span className="text-xs text-muted-foreground">
								Loading...
							</span>
						</div>
					) : (
						<ArkSelect.Select
							className="w-48"
							value={selectedDatabase ? [selectedDatabase] : []}
							collection={databaseCollection}
							positioning={{ sameWidth: true }}
							disabled={databasesQuery.isLoading}
							onValueChange={(details: any) => {
								const newDatabase = details.value?.[0];
								if (newDatabase) {
									setSelectedDatabase(newDatabase);
									setDatabase(newDatabase);
								}
							}}
						>
							<ArkSelect.SelectControl>
								<ArkSelect.SelectTrigger>
									<ArkSelect.SelectValueText placeholder="Select database" />
									<ArkSelect.SelectIndicator />
								</ArkSelect.SelectTrigger>
							</ArkSelect.SelectControl>
							<ArkSelect.SelectContent>
								{databaseCollection.items.map((item: any) => (
									<ArkSelect.SelectItem key={item.value} item={item}>
										{item.label}
									</ArkSelect.SelectItem>
								))}
							</ArkSelect.SelectContent>
						</ArkSelect.Select>
					)}
				</div>
			</div>

			{/* Main Layout */}
			<div className="flex-1 flex overflow-hidden">
				{/* Sidebar */}
				<div className="w-64 border-r bg-muted/30 flex flex-col">
					{/* Schema Selector */}
					<div className="p-4 border-b space-y-2">
						<label className="text-xs font-medium text-foreground uppercase tracking-wide">
							Schema
						</label>
						{schemasQuery.isLoading ? (
							<div className="flex items-center justify-center rounded-md border border-input bg-card px-3 py-2 min-h-9">
								<span className="text-xs text-muted-foreground">
									Loading...
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
									}
								}}
							>
								<ArkSelect.SelectControl>
									<ArkSelect.SelectTrigger>
										<ArkSelect.SelectValueText placeholder="Select schema" />
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

					{/* Tables List */}
					<div className="flex-1 overflow-hidden flex flex-col">
						<div className="p-4 border-b">
							<label className="text-xs font-medium text-foreground uppercase tracking-wide">
								Tables
							</label>
						</div>
						<div className="flex-1 overflow-y-auto">
							{tablesQuery.isLoading ? (
								<div className="p-4 text-center">
									<p className="text-xs text-muted-foreground">
										Loading tables...
									</p>
								</div>
							) : tables.length === 0 ? (
								<div className="p-4 text-center">
									<p className="text-xs text-muted-foreground">
										No tables found
									</p>
								</div>
							) : (
								<div className="space-y-1 p-2">
									{tables.map((table: any) => (
										<button
											key={table.name}
											onClick={() => {
												setSelectedTable(table.name);
												setTable(table.name);
												setShowTableStructure(false);
											}}
											className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
												selectedTable === table.name
													? "bg-primary/10 text-primary font-medium"
													: "text-muted-foreground hover:bg-muted hover:text-foreground"
											}`}
										>
											{table.name}
										</button>
									))}
								</div>
							)}
						</div>
					</div>
				</div>

				{/* Content Area */}
				<div className="flex-1 flex flex-col overflow-hidden">
					{selectedTable && selectedSchema ? (
						<>
							{/* View Toggle */}
							<div className="border-b bg-muted/50 px-4 py-2 flex gap-2">
								<Button
									variant={!showTableStructure ? "default" : "outline"}
									size="sm"
									onClick={() => setShowTableStructure(false)}
									className="text-xs"
								>
									Rows
								</Button>
								<Button
									variant={showTableStructure ? "default" : "outline"}
									size="sm"
									onClick={() => setShowTableStructure(true)}
									className="text-xs"
								>
									Structure
								</Button>
							</div>

							{/* Content */}
							<div className="flex-1 overflow-hidden flex flex-col">
								{showTableStructure ? (
									<div className="p-4">
										<div className="space-y-2">
											<h3 className="font-semibold text-sm">
												{tableDisplayName} - Columns
											</h3>
											<div className="space-y-1 text-sm">
												{columns.map((col: any) => (
													<div
														key={col.accessorKey}
														className="text-muted-foreground"
													>
														• {col.accessorKey}
													</div>
												))}
											</div>
										</div>
									</div>
								) : (
									<div className="flex-1 overflow-auto flex flex-col">
										{tableDataQuery.isLoading ? (
											<div className="flex-1 flex items-center justify-center">
												<p className="text-muted-foreground">
													Loading table data...
												</p>
											</div>
										) : tableDataQuery.isError ? (
											<div className="flex-1 flex items-center justify-center">
												<p className="text-destructive">
													Error loading table data
												</p>
											</div>
										) : (
											<div className="flex-1 overflow-auto">
												<DataTable
													table={dataTable}
													isLoading={tableDataQuery.isLoading}
												/>
											</div>
										)}
										{/* Status Bar */}
										<div className="border-t bg-muted/50 px-4 py-2 text-xs text-muted-foreground space-y-1">
											<div className="flex items-center justify-between">
												<span>
													{tableDisplayName} • {tableData.length} rows (0-
													{tableData.length}) • {columns.length} columns
												</span>
												<Button
													variant="ghost"
													size="sm"
													onClick={() => tableDataQuery.refetch()}
													className="h-6 px-2"
												>
													<RefreshCw className="h-3 w-3" />
												</Button>
											</div>
											<div className="text-xs text-muted-foreground flex items-center justify-between">
												<span>
													{queryResponse.timeTaken > 0 && `${queryResponse.timeTaken}ms • Loaded ${formatRelativeTime(queryResponse.ranAt)}`}
												</span>
											</div>
										</div>
									</div>
								)}
							</div>
						</>
					) : (
						<div className="flex-1 flex items-center justify-center">
							<div className="text-center">
								<p className="text-muted-foreground">
									Select a schema and table to view data
								</p>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};
