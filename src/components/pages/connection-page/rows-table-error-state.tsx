import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useRef, useMemo, useState, useEffect } from "react";
import { useFilter } from "@ark-ui/react/locale";
import { Listbox, createListCollection } from "@ark-ui/react/listbox";
import { listAvailableSchemasQueryOptions } from "#src/server/introspection/start-fns/get-available-schemas.start.ts";
import { listAvailableTablesQueryOptions } from "#src/server/introspection/start-fns/get-available-tables.start.ts";
import { queryTableDataQueryOptions } from "#src/server/introspection/start-fns/query-table-data.start.ts";
import { useQueryClient } from "@tanstack/react-query";
import { getDbNameFromConnectionUrl } from "#src/lib/replace-database-in-connection-url.ts";
import { ErrorBoundaryCard } from "../../shared/error-boundary-card.tsx";
import { Button } from "../../ui/button";
import { DatabaseDialect, getDialectDefaultSchema } from "#src/db/dialect.ts";
import type { DbConnection } from "../connection.types";
import { useActiveTabState, createTabState } from "./create-tab-state.ts";

interface RowsTableErrorStateProps {
	activeConnectionUrl: string;
	connection: DbConnection;
}

export const RowsTableErrorState = ({
	activeConnectionUrl,
	connection,
}: RowsTableErrorStateProps) => {
	const navigate = useNavigate({ from: "/connections/$connectionName" });
	const schemaListQuery = useQuery({
		...listAvailableSchemasQueryOptions({ url: activeConnectionUrl }),
		enabled: !!activeConnectionUrl,
		retry: 3,
	});
	return (
		<div className="flex-1 flex items-center justify-center">
			{schemaListQuery.isError ? (
				<div className="max-w-2xl w-full mx-4">
					<div className="flex flex-col gap-3">
						<ErrorBoundaryCard
							error={schemaListQuery.error}
							title="Failed to connect to database"
							onRetry={() => schemaListQuery.refetch()}
						/>
						<Button
							variant="outline"
							size="sm"
							onClick={() => {
								navigate({ to: "/" });
							}}
						>
							Back to Connections
						</Button>
					</div>
				</div>
			) : (
				<NoTableSelectedState
					activeConnectionUrl={activeConnectionUrl}
					connection={connection}
				/>
			)}
		</div>
	);
};

interface NoTableSelectedStateProps {
	activeConnectionUrl: string;
	connection: DbConnection;
}

const NoTableSelectedState = ({
	activeConnectionUrl,
	connection,
}: NoTableSelectedStateProps) => {
	const navigate = useNavigate({ from: "/connections/$connectionName" });
	const queryClient = useQueryClient();
	const inputRef = useRef<HTMLInputElement>(null);
	const [filterText, setFilterText] = useState("");
	const { contains } = useFilter({ sensitivity: "base" });

	const selectedSchema = useActiveTabState((s) => s.schema);

	const tablesListQuery = useQuery({
		...listAvailableTablesQueryOptions({ url: activeConnectionUrl }),
		enabled: !!selectedSchema,
		retry: 3,
	});
	const tableList = tablesListQuery.data || [];

	const isNotSqlite = !(
		connection.dialect === DatabaseDialect.SQLite ||
		connection.dialect === DatabaseDialect.LibSQL
	);

	const filteredTables = useMemo(
		() =>
			tableList.filter(
				(table) =>
					(filterText ? contains(table.name, filterText) : true) &&
					(isNotSqlite ? selectedSchema === table.schema : true),
			),
		[tableList, filterText, selectedSchema, contains, isNotSqlite],
	);

	const tableCollection = useMemo(
		() =>
			createListCollection({
				items: filteredTables.map((t) => ({
					label: t.name,
					value: t.name,
				})),
			}),
		[filteredTables],
	);

	// Auto-focus input on mount
	useEffect(() => {
		inputRef.current?.focus();
	}, []);

	const handleTableSelect = (table: (typeof filteredTables)[0]) => {
		const schema =
			selectedSchema || getDialectDefaultSchema(connection.dialect);
		queryClient.prefetchQuery({
			...queryTableDataQueryOptions({
				url: activeConnectionUrl,
				schema,
				table: table.name,
				limit: 50,
				offset: 0,
				orderBy: undefined,
				orderDirection: undefined,
				filters: {
					conditions: [],
					logicalOperator: "and",
				},
			}),
		});
		navigate({
			search: (prev) => ({
				...prev,
				schema,
				table: table.name,
				offset: 0,
			}),
		});
	};

	if (tablesListQuery.isLoading) {
		return (
			<div className="text-center">
				<span className="text-muted-foreground">Loading tables...</span>
			</div>
		);
	}

	return (
		<div className="w-full max-w-sm">
			<div className="flex flex-col gap-3">
				<div>
					<label className="text-sm font-medium text-foreground mb-2 block">
						Search tables
					</label>
					<input
						ref={inputRef}
						type="text"
						placeholder="Type to filter tables..."
						value={filterText}
						onChange={(e) => setFilterText(e.target.value)}
						className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
					/>
				</div>

				{filteredTables.length === 0 ? (
					<div className="p-4 text-center border border-dashed rounded-md">
						<span className="text-sm text-muted-foreground">
							{tableList.length === 0
								? "No tables available"
								: "No tables match filter"}
						</span>
					</div>
				) : (
					<div className="border rounded-md bg-card">
						<Listbox.Root collection={tableCollection}>
							<Listbox.Content className="overflow-visible">
								<Listbox.ItemGroup>
									{filteredTables.map((table) => (
										<Listbox.Item
											key={table.name}
											item={{
												label: table.name,
												value: table.name,
											}}
											className="px-3 py-2 cursor-pointer text-sm transition-colors hover:bg-muted data-highlighted:bg-muted"
											onClick={() => handleTableSelect(table)}
										>
											<Listbox.ItemText>{table.name}</Listbox.ItemText>
										</Listbox.Item>
									))}
								</Listbox.ItemGroup>
							</Listbox.Content>
						</Listbox.Root>
					</div>
				)}
			</div>
		</div>
	);
};
