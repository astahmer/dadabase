import { Popover, Portal } from "@ark-ui/react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { LogOut, Maximize2, Minimize, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { TableRelationship } from "#src/components/pages/connection-page/relationships/relationships.ts";
import { useRowsColumnsAction } from "#src/components/pages/connection-page/use-rows-columns.actions.ts";
import { getRelationshipCardinalityQueryOptions } from "../../../../server/introspection/start-fns/get-relationship-cardinality.start.ts";
import { queryRelationshipSubrowDataQueryOptions } from "../../../../server/introspection/start-fns/get-relationship-subrow-data.start.ts";
import { PaginationPopoverContent } from "../../../app/pagination.popover-content.tsx";
import { DataTable } from "../../../data-table/data-table.tsx";
import { ScrollToColumnButton } from "../../../data-table/scroll-to-column.button.tsx";
import { useDataTable } from "../../../data-table/use-data-table.ts";
import { ErrorBoundaryCard } from "../../../shared/error-boundary-card.tsx";
import { Button } from "../../../ui/button.tsx";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "../../../ui/sheet.tsx";
import { Spinner } from "../../../ui/spinner.tsx";
import { useRowsColumns } from "../use-rows-columns.tsx";
import { useTableColumnMetadata } from "../use-table-column-metadata.ts";

interface RelationshipSubrowTableProps {
	relationship: TableRelationship;
	parentRowValue: string;
	connection: { url: string };
	isPanelExpanded?: boolean;
	withHeader?: boolean;
	onRemove?: () => void;
}

const initialLimit = 50;

/**
 * Renders a nested DataTable in a subrow containing related records
 * Queries the referencing table filtered by parent row's primary key
 */
export const RelationshipSubrowTable = ({
	relationship,
	parentRowValue,
	connection,
	isPanelExpanded = false,
	withHeader = true,
	onRemove,
}: RelationshipSubrowTableProps) => {
	const [limit, setLimit] = useState(initialLimit);
	const [pageIndex, setPageIndex] = useState(0);

	const {
		referencingSchema,
		referencingTable,
		referencingColumn,
		referencedTable,
		referencedColumn,
	} = relationship;

	// Calculate offset based on page index and limit
	const offset = pageIndex * limit;

	// Fetch rows from the referencing table filtered by parent value
	const rowsQuery = useQuery({
		...queryRelationshipSubrowDataQueryOptions({
			url: connection.url,
			schema: referencingSchema,
			table: referencingTable,
			filterColumn: referencingColumn,
			filterValue: parentRowValue,
			limit,
			offset,
		}),
		placeholderData: keepPreviousData,
	});

	// Fetch cardinality detection
	const cardinalityQuery = useQuery(
		getRelationshipCardinalityQueryOptions({
			url: connection.url,
			schema: referencingSchema,
			table: referencingTable,
			columns: [referencingColumn],
			isIncomingRelationship:
				(relationship as TableRelationship).type === "incoming",
		}),
	);

	const tableMetadata = useTableColumnMetadata({
		url: connection.url,
		schema: referencingSchema,
		table: referencingTable,
	});

	const rowActions = useRowsColumnsAction({
		columnMetadata: tableMetadata.columnMetadata,
		selectedSchema: referencingSchema,
		selectedTable: referencingTable,
		activeConnectionUrl: connection.url,
	});
	const dataColumns = useRowsColumns({
		columnMetadata: tableMetadata.columnMetadata,
		schema: referencingSchema,
		table: referencingTable,
		activeConnectionUrl: connection.url,
		enableSorting: true,
		onFollowFK: rowActions.onFollowFK,
		onFindReferences: rowActions.onFindReferences,
		onShowQuickReferences: rowActions.onShowQuickReferences,
		onPrefetchReferences: rowActions.onPrefetchReferences,
		onNavigateToFK: rowActions.onNavigateToFK,
		onNavigateToReference: rowActions.onNavigateToReference,
		onExpandToSheet: rowActions.onExpandToSheet,
		onMenuOpen: rowActions.onMenuOpen,
	});
	const tableColumns = useMemo(() => {
		return [
			{
				id: "__rowIndex",
				meta: { enableColumnOrdering: false },
				header: () => <div className="text-center w-full">#</div>,
				cell: (ctx) => {
					const displayedNumber = pageIndex * limit + ctx.row.index + 1;
					return (
						<div className="flex items-center justify-center text-xs text-muted-foreground font-medium">
							{displayedNumber}
						</div>
					);
				},
				size: 50,
				minSize: 50,
				maxSize: 50,
				enableResizing: false,
				enableSorting: false,
				enablePinning: false,
			} as ColumnDef<Record<string, unknown>>,
		].concat(dataColumns);
	}, [dataColumns, limit, pageIndex]);

	const table = useDataTable({
		// enableColumnPinning: false,
		data: (rowsQuery.data?.rows ?? []) as Record<string, unknown>[],
		columns: tableColumns,
		manualPagination: true,
		state: {
			pagination: {
				pageIndex: pageIndex,
				pageSize: limit,
			},
		},
	});

	const [tableContainer, setTableContainer] = useState<HTMLDivElement | null>(
		null,
	);
	const [isMaximizeSheetOpen, setIsMaximizeSheetOpen] = useState(false);

	const rowCount = rowsQuery.data?.rowCount ?? 0;
	const hasData = rowCount > 0;

	if (rowsQuery.isLoading) {
		return (
			<div className="flex items-center justify-center p-8 gap-2">
				<Spinner />
				<span className="text-sm text-muted-foreground">
					Loading {referencingSchema}.{referencingTable}...
				</span>
			</div>
		);
	}

	if (rowsQuery.isError) {
		return (
			<ErrorBoundaryCard
				error={rowsQuery.error}
				title={`Failed to load ${referencingSchema}.${referencingTable}`}
				onRetry={() => rowsQuery.refetch()}
			/>
		);
	}

	return (
		<>
			{/* Info Bar */}
			{withHeader && (
				<div className="px-4 py-2 border-b bg-muted/20 flex items-center justify-between shrink-0 text-xs gap-2">
					<div className="flex items-center gap-2 min-w-0">
						<span className="text-muted-foreground truncate">
							<span className="text-foreground font-medium">
								{referencingTable}
							</span>
							<span className="text-muted-foreground">
								.{referencingColumn}
							</span>
						</span>
						<span className="text-muted-foreground shrink-0">=</span>
						<span className="font-medium truncate">{parentRowValue}</span>

						{cardinalityQuery.data && (
							<span className="text-xs bg-blue-500/20 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded shrink-0">
								{cardinalityQuery.data === "one-to-one"
									? "1:1"
									: cardinalityQuery.data === "one-to-many"
										? "1:N"
										: cardinalityQuery.data === "many-to-one"
											? "N:1"
											: "M:N"}
							</span>
						)}

						{hasData && (
							<span className="text-muted-foreground shrink-0">
								{rowCount} row{rowCount !== 1 ? "s" : ""}
							</span>
						)}
					</div>

					<div className="flex items-center gap-1 shrink-0">
						{isPanelExpanded && hasData && (
							<Button
								size="xs"
								variant="ghost"
								onClick={() => setIsMaximizeSheetOpen(true)}
								title="Expand to full view"
								className="h-6 px-2 gap-1"
							>
								<Maximize2 className="h-3 w-3" />
								<span className="text-xs">Maximize</span>
							</Button>
						)}
						{onRemove && (
							<Button
								size="xs"
								variant="ghost"
								onClick={onRemove}
								title="Remove from view"
								className="h-6 px-2"
							>
								<X className="h-3 w-3" />
							</Button>
						)}
					</div>
				</div>
			)}

			{/* Data Table - Only render when there's data */}
			{hasData && (
				<div className="flex-1 overflow-hidden flex flex-col">
					<div className="flex-1 overflow-hidden">
						<DataTable
							hideColumnPinIconUnlessHovered
							table={table}
							size="compact"
							isLoading={rowsQuery.isLoading}
							hasError={rowsQuery.isError}
						/>
					</div>

					{/* Pagination Controls */}
					<div className="border-t bg-muted/20 px-4 py-2 flex items-center justify-between shrink-0 text-xs gap-2 w-full hover:bg-muted/30 transition-colors">
						<div className="flex items-center gap-1">
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setPageIndex(Math.max(0, pageIndex - 1))}
								disabled={pageIndex === 0}
								className="h-6 px-2"
							>
								‹
							</Button>
							<Popover.Root
								// open={open}
								// onOpenChange={(details) => onOpenChange(details.open)}
								lazyMount
								positioning={{ placement: "top" }}
							>
								<Popover.Trigger asChild>
									<span className="cursor-pointer">
										<span className="text-xs text-foreground">
											{pageIndex + 1} / {Math.ceil(rowCount / limit)}
										</span>
										<span className="text-xs text-muted-foreground mx-1">
											(showing {pageIndex * limit + 1}–
											{Math.min((pageIndex + 1) * limit, rowCount)} rows of{" "}
											{rowCount})
										</span>
									</span>
								</Popover.Trigger>
								<Portal>
									<Popover.Positioner>
										<Popover.Content className="z-50 rounded-md border border-border bg-background p-3 shadow-md">
											<PaginationPopoverContent
												initialPageIndex={pageIndex}
												pageSize={limit}
												totalRowCount={rowCount}
												onPageSizeChange={(newLimit) => {
													setLimit(newLimit);
													setPageIndex(0);
												}}
												onConfirm={(newPageIndex) => {
													setPageIndex(newPageIndex);
												}}
												isLoading={rowsQuery.isLoading}
											/>
										</Popover.Content>
									</Popover.Positioner>
								</Portal>
							</Popover.Root>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => {
									const maxPageIndex = Math.ceil(rowCount / limit) - 1;
									setPageIndex(Math.min(pageIndex + 1, maxPageIndex));
								}}
								disabled={pageIndex >= Math.ceil(rowCount / limit) - 1}
								className="h-6 px-2"
							>
								›
							</Button>
						</div>

						{/* Show More Button - only show if not all rows are displayed */}
						<div className="flex items-center gap-2">
							{rowsQuery.isFetching && <Spinner className="h-4 w-4" />}
							{limit < rowCount && (
								<Button
									variant="outline"
									size="sm"
									onClick={() => {
										setLimit(limit + initialLimit);
										setPageIndex(0);
									}}
									className="h-6 px-2 text-xs"
									title={`Load ${Math.min(initialLimit, rowCount - limit)} more rows`}
									disabled={rowsQuery.isLoading}
								>
									Show {initialLimit} more rows ({rowCount - limit} remaining)
								</Button>
							)}
							{isPanelExpanded && (
								<Button
									size="xs"
									variant="ghost"
									onClick={() => setIsMaximizeSheetOpen(true)}
									title="Expand to full view"
									className="h-6 px-2 gap-1"
								>
									<Maximize2 className="h-3 w-3" />
								</Button>
							)}
						</div>
					</div>
				</div>
			)}

			{/* Maximize Sheet */}
			<Sheet
				open={isMaximizeSheetOpen}
				onOpenChange={(details) => setIsMaximizeSheetOpen(details.open)}
			>
				<SheetContent
					side="bottom"
					className="h-[90vh] flex flex-col px-6"
					positionerProps={{ className: "relative z-2" }}
				>
					<SheetHeader>
						<SheetTitle className="text-base">
							<div className="flex items-center">
								{referencingTable}.
								<span className="text-muted-foreground">
									{referencingColumn}
								</span>
								<span className="text-muted-foreground mx-2">›</span>
								{referencedTable}.
								<span className="text-muted-foreground">
									{referencedColumn}
								</span>
							</div>
						</SheetTitle>
					</SheetHeader>
					<div className="flex-1 relative overflow-hidden flex flex-col">
						<div className="flex-1 overflow-hidden">
							<DataTable
								table={table}
								getTableContainer={setTableContainer}
								className="relative"
								size="compact"
								striped
								stickyHeader={true}
								isLoading={rowsQuery.isLoading}
								hasError={rowsQuery.isError}
							/>
							{!rowsQuery.isLoading && !tableMetadata.isLoading && (
								<ScrollToColumnButton
									table={table}
									containerRef={{ current: tableContainer }}
								/>
							)}
						</div>

						{/* Pagination Controls */}
						<div className="border-t bg-muted/20 px-4 py-2 flex items-center justify-between shrink-0 text-xs gap-2 w-full hover:bg-muted/30 transition-colors">
							<div className="flex items-center gap-1">
								<Button
									variant="ghost"
									size="sm"
									onClick={() => setPageIndex(Math.max(0, pageIndex - 1))}
									disabled={pageIndex === 0}
									className="h-6 px-2"
								>
									‹
								</Button>
								<Popover.Root lazyMount positioning={{ placement: "top" }}>
									<Popover.Trigger asChild>
										<span className="cursor-pointer">
											<span className="text-xs text-foreground">
												{pageIndex + 1} / {Math.ceil(rowCount / limit)}
											</span>
											<span className="text-xs text-muted-foreground mx-1">
												(showing {pageIndex * limit + 1}–
												{Math.min((pageIndex + 1) * limit, rowCount)} rows of{" "}
												{rowCount})
											</span>
										</span>
									</Popover.Trigger>
									<Portal>
										<Popover.Positioner>
											<Popover.Content className="z-50 rounded-md border border-border bg-background p-3 shadow-md">
												<PaginationPopoverContent
													initialPageIndex={pageIndex}
													pageSize={limit}
													totalRowCount={rowCount}
													onPageSizeChange={(newLimit) => {
														setLimit(newLimit);
														setPageIndex(0);
													}}
													onConfirm={(newPageIndex) => {
														setPageIndex(newPageIndex);
													}}
													isLoading={rowsQuery.isLoading}
												/>
											</Popover.Content>
										</Popover.Positioner>
									</Portal>
								</Popover.Root>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => {
										const maxPageIndex = Math.ceil(rowCount / limit) - 1;
										setPageIndex(Math.min(pageIndex + 1, maxPageIndex));
									}}
									disabled={pageIndex >= Math.ceil(rowCount / limit) - 1}
									className="h-6 px-2"
								>
									›
								</Button>
							</div>

							{/* Show More Button - only show if not all rows are displayed */}
							<div className="flex items-center gap-2">
								{rowsQuery.isFetching && <Spinner className="h-4 w-4" />}
								{limit < rowCount && (
									<Button
										variant="outline"
										size="sm"
										onClick={() => {
											setLimit(limit + initialLimit);
											setPageIndex(0);
										}}
										className="h-6 px-2 text-xs"
										title={`Load ${Math.min(initialLimit, rowCount - limit)} more rows`}
										disabled={rowsQuery.isLoading}
									>
										Show {initialLimit} more rows ({rowCount - limit} remaining)
									</Button>
								)}
								<Button
									size="xs"
									variant="ghost"
									onClick={() => setIsMaximizeSheetOpen(false)}
									title="Close maximized view"
									className="h-6 px-2"
								>
									<LogOut className="h-3 w-3" />
								</Button>
							</div>
						</div>
					</div>
				</SheetContent>
			</Sheet>
		</>
	);
};
