import { Pagination } from "@ark-ui/react/pagination";
import { useNavigate } from "@tanstack/react-router";
import type { Table as TanstackTable } from "@tanstack/react-table";
import { DateTime } from "effect";
import { Layers, RefreshCw } from "lucide-react";
import { formatRelativeTime } from "#src/lib/format-relative-time.ts";
import { getDefaultColumnSize } from "#src/lib/get-default-column-size.ts";
import type { DataTableSize } from "../../data-table/data-table.styles.ts";
import { Button } from "../../ui/button";
import { HStack } from "../../ui/layout.tsx";
import * as ArkSelect from "../../ui/select";
import { Tooltip } from "../../ui/tooltip.tsx";
import { updateTabState, useActiveTabState } from "./create-tab-state.ts";
import { RowsPerPageSelector } from "./rows-per-page.selector.tsx";

const TableSizeCollection = ArkSelect.createListCollection({
	items: [
		{ label: "Excel", value: "excel" },
		{ label: "Minimal", value: "minimal" },
		{ label: "Compact", value: "compact" },
		{ label: "Cozy", value: "cozy" },
		{
			label: "Comfortable",
			value: "comfortable",
		},
	],
});

interface ConnectionPageStatusBarProps {
	table: TanstackTable<any>;
	hasUuid: boolean;
	isLoading: boolean;
	refetch: () => void;
	timeTaken: number;
	ranAt: number;
	totalRowCount: number;
	rowsColumnsCount: number;
	isCustomSql: boolean;
}

export const ConnectionPageStatusBar = (
	props: ConnectionPageStatusBarProps,
) => {
	const { isLoading, refetch, isCustomSql } = props;

	const navigate = useNavigate({ from: "/connections/$connectionName" });

	const selectedSchema = useActiveTabState((s) => s.schema);
	const selectedTable = useActiveTabState((s) => s.table);
	const tableDisplayName = selectedTable
		? `${selectedSchema}.${selectedTable}`
		: "No table selected";

	const offset = useActiveTabState((s) => s.offset);
	const limit = useActiveTabState((s) => s.limit);
	const tableSize = useActiveTabState((s) => s.tableSize);
	const prefixWithTable = useActiveTabState((s) => s.prefixWithTable);
	const joins = useActiveTabState((s) => s.joins);

	return (
		<div className="border-t bg-muted/50 px-4 py-2 text-xs text-muted-foreground">
			<div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 lg:gap-4">
				{/* Left side - Table info */}
				<HStack className="flex-1 min-w-0 whitespace-nowrap overflow-x-auto">
					{isLoading ? (
						<span className="text-muted-foreground/50">Loading...</span>
					) : isCustomSql ? (
						<span className="truncate">
							{tableDisplayName}
							<span className="hidden sm:inline text-muted-foreground">
								{" "}
								• Custom SQL
							</span>
						</span>
					) : (
						<>
							<span className="truncate">
								{tableDisplayName}
								<span className="hidden sm:inline">
									{" "}
									({props.rowsColumnsCount} columns)
								</span>
							</span>
							<span className="shrink-0">
								{offset}-{Math.min(props.totalRowCount, offset + limit)}{" "}
								<span className="hidden md:inline">out of </span>
								<span className="hidden md:inline">{props.totalRowCount}</span>
							</span>
						</>
					)}
				</HStack>
				{/* Middle - Query time info */}
				<span className="hidden lg:inline text-muted-foreground text-xs">
					{props.timeTaken > 0 && (
						<HStack gap="1" align="center">
							{`${props.timeTaken}ms`}
							<span>•</span>
							<Tooltip
								content={DateTime.formatIso(DateTime.unsafeMake(props.ranAt))}
							>
								<span>Loaded {formatRelativeTime(props.ranAt)}</span>
							</Tooltip>
						</HStack>
					)}
				</span>
				{/* Right side - Controls */}
				<div className="flex flex-wrap items-center gap-2 lg:gap-3">
					{/* Hide pagination and sizing controls for non-SELECT custom SQL */}
					{!isCustomSql && (
						<>
							{/* Pagination Controls */}
							<Pagination.Root
								count={props.totalRowCount}
								pageSize={limit}
								siblingCount={1}
								page={Math.floor(offset / limit) + 1}
								onPageChange={(details) => {
									navigate({
										search: (prev) =>
											updateTabState(prev, {
												offset: (details.page - 1) * limit,
											}),
									});
								}}
							>
								<Pagination.Context>
									{(pagination) => (
										<div className="flex items-center gap-1">
											<Pagination.PrevTrigger asChild>
												<Button variant="ghost" size="sm" className="h-6 px-1">
													‹
												</Button>
											</Pagination.PrevTrigger>
											<span className="text-xs mx-2">
												{pagination.page} /{" "}
												{pagination.totalPages === 0
													? "..."
													: pagination.totalPages}
											</span>
											<Pagination.NextTrigger asChild>
												<Button variant="ghost" size="sm" className="h-6 px-1">
													›
												</Button>
											</Pagination.NextTrigger>
										</div>
									)}
								</Pagination.Context>
							</Pagination.Root>

							<div className="flex items-center gap-2 text-foreground">
								<label className="font-medium uppercase tracking-wide whitespace-nowrap">
									Limit:
								</label>
								<RowsPerPageSelector
									value={limit}
									onValueChange={(newLimit: number) => {
										navigate({
											search: (prev) =>
												updateTabState(prev, {
													limit: newLimit,
													offset: 0,
												}),
										});
									}}
								/>
							</div>
							<div className="flex items-center gap-2 text-foreground">
								<ArkSelect.Select
									className="w-28"
									value={[tableSize]}
									collection={TableSizeCollection}
									positioning={{ sameWidth: true }}
									onValueChange={(details) => {
										const newSize = (details.value?.[0] ||
											"cozy") as DataTableSize;
										navigate({
											search: (prev) =>
												updateTabState(prev, {
													tableSize: newSize,
												}),
										});

										const newSizing: Record<string, number> = {};
										const defaultSize = getDefaultColumnSize({
											tableSize: newSize,
											hasUuid: props.hasUuid,
										});
										for (const col of props.table.getAllColumns()) {
											newSizing[col.id] = defaultSize;
										}

										props.table.setColumnSizing(newSizing);
									}}
								>
									<ArkSelect.SelectControl>
										<ArkSelect.SelectTrigger>
											<ArkSelect.SelectValueText />
											<ArkSelect.SelectIndicator />
										</ArkSelect.SelectTrigger>
									</ArkSelect.SelectControl>
									<ArkSelect.SelectContent>
										{TableSizeCollection.items.map((item) => (
											<ArkSelect.SelectItem key={item.value} item={item}>
												{item.label}
											</ArkSelect.SelectItem>
										))}
									</ArkSelect.SelectContent>
								</ArkSelect.Select>
							</div>
							{(joins?.length ?? 0) > 0 && (
								<Tooltip
									content={
										prefixWithTable
											? "Disable table prefix"
											: "Prefix columns with table"
									}
								>
									<Button
										variant={prefixWithTable ? "default" : "ghost"}
										size="sm"
										onClick={() => {
											navigate({
												search: (prev) =>
													updateTabState(prev, (tab) => ({
														prefixWithTable: !tab.prefixWithTable,
													})),
											});
										}}
										className="h-6 px-2"
										title="Prefix column names by table"
									>
										<Layers className="h-3.5 w-3.5" />
									</Button>
								</Tooltip>
							)}
						</>
					)}
					<Tooltip
						content={`Refresh rows (last ran at ${DateTime.formatIso(DateTime.unsafeMake(props.ranAt))})`}
					>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => refetch()}
							className="h-6 px-2"
						>
							<RefreshCw className="h-3 w-3" />
						</Button>
					</Tooltip>
				</div>
			</div>
		</div>
	);
};
