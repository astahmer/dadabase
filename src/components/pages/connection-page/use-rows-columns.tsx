import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ColumnHeaderWithInfo } from "#src/components/app/column-header-with-info.tsx";
import { ForeignKeyIcon } from "#src/components/app/foreign-key-icon.tsx";
import { JsonCell } from "#src/components/ui/json-cell.tsx";
import { MemoizedDataCell } from "#src/components/memoized-data-cell.tsx";
import { PrimaryKeyIcon } from "#src/components/app/primary-key-icon.tsx";
import { UniqueConstraintIcon } from "#src/components/app/unique-constraint-icon.tsx";
import { getColumnTextAlignment } from "#src/lib/data-type-utils";
import { findColumnReferencesWithCountsQueryOptions } from "#src/server/pg/start-fns/find-column-references.start.ts";
import type { ForeignKeyInfo } from "#src/components/data-table/cell-context-menu.tsx";

interface ColumnMetadata {
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
		constraintName: string;
	};
}

export interface UseRowsColumnsOptions {
	columnMetadata: ColumnMetadata[];
	schema: string;
	table: string;
	activeConnectionUrl: string;
	// TODO rename those; hard to know which does what
	onFollowFK?: (fkInfo: ForeignKeyInfo, cellValue: unknown) => void;
	onFindReferences?: (columnName: string, cellValue: unknown) => void;
	onShowQuickReferences?: (columnName: string, cellValue: unknown) => void;
	onPrefetchReferences?: (columnName: string, cellValue: unknown) => void;
	onNavigateToFK?: (fkInfo: ForeignKeyInfo, cellValue: unknown) => void;
	onNavigateToReference?: (
		ref: { schema: string; table: string; column: string },
		cellValue: unknown,
	) => void;
	onExpandToSheet?: (columnName: string, cellValue: unknown) => void;
	onMenuOpen?: (columnName: string, cellValue: unknown) => void;
	enableSorting?: boolean;
}

/**
 * Hook to build data columns with proper metadata display and cell rendering
 * Handles JSON columns, memoized data cells, and all navigation callbacks
 */
export const useRowsColumns = ({
	columnMetadata,
	schema,
	table,
	activeConnectionUrl,
	onFollowFK,
	onFindReferences,
	onShowQuickReferences,
	onPrefetchReferences,
	onNavigateToFK,
	onNavigateToReference,
	onExpandToSheet,
	onMenuOpen,
	enableSorting = true,
}: UseRowsColumnsOptions): ColumnDef<Record<string, unknown>>[] => {
	const queryClient = useQueryClient();

	return useMemo<ColumnDef<Record<string, unknown>>[]>(() => {
		if (!columnMetadata.length) return [];

		return columnMetadata.map(
			(col) =>
				({
					accessorKey: col.name,
					header: () => (
						<ColumnHeaderWithInfo
							columnName={col.name}
							dataType={col.dataType}
							showBadge
							isPrimaryKey={col.primaryKey}
							isUnique={col.unique}
							isForeignKey={col.isForeignKey}
							foreignKey={col.foreignKey}
						>
							<PrimaryKeyIcon isPrimaryKey={col.primaryKey} />
							<UniqueConstraintIcon isUnique={col.unique} />
							<ForeignKeyIcon isForeignKey={col.isForeignKey ?? false} />
						</ColumnHeaderWithInfo>
					),
					meta: {
						textAlign: getColumnTextAlignment(col.dataType),
					},
					cell: col.dataType.toLowerCase().includes("json")
						? (ctx) => <JsonCell value={ctx.row.original[col.name]} />
						: (ctx) => {
								const cellValue = ctx.row.original[col.name];
								return (
									<MemoizedDataCell
										ctx={ctx}
										col={col}
										schema={schema}
										table={table}
										activeConnectionUrl={activeConnectionUrl}
										onFollowFK={onFollowFK}
										onFindReferences={onFindReferences}
										onShowQuickReferences={() => {
											onShowQuickReferences?.(col.name, cellValue);
										}}
										onPrefetchReferences={() => {
											const referenceTarget = col.foreignKey
												? {
														referencedSchema: col.foreignKey.referencedSchema,
														referencedTable: col.foreignKey.referencedTable,
														referencedColumn: col.foreignKey.referencedColumn,
													}
												: {
														referencedSchema: schema,
														referencedTable: table,
														referencedColumn: col.name,
													};

											queryClient.prefetchQuery(
												findColumnReferencesWithCountsQueryOptions({
													url: activeConnectionUrl,
													referencedSchema: referenceTarget.referencedSchema,
													referencedTable: referenceTarget.referencedTable,
													referencedColumn: referenceTarget.referencedColumn,
													cellValue,
												}),
											);
											onPrefetchReferences?.(col.name, cellValue);
										}}
										onNavigateToFK={onNavigateToFK}
										onNavigateToReference={onNavigateToReference}
										onExpandToSheet={() => {
											onExpandToSheet?.(col.name, cellValue);
										}}
										onMenuOpen={() => {
											const referenceTarget = col.foreignKey
												? {
														referencedSchema: col.foreignKey.referencedSchema,
														referencedTable: col.foreignKey.referencedTable,
														referencedColumn: col.foreignKey.referencedColumn,
													}
												: {
														referencedSchema: schema,
														referencedTable: table,
														referencedColumn: col.name,
													};

											queryClient.prefetchQuery(
												findColumnReferencesWithCountsQueryOptions({
													url: activeConnectionUrl,
													referencedSchema: referenceTarget.referencedSchema,
													referencedTable: referenceTarget.referencedTable,
													referencedColumn: referenceTarget.referencedColumn,
													cellValue,
												}),
											);
											onMenuOpen?.(col.name, cellValue);
										}}
									/>
								);
							},
					enableResizing: true,
					enableSorting,
				}) as ColumnDef<any> as any,
		);
	}, [
		columnMetadata,
		schema,
		table,
		activeConnectionUrl,
		enableSorting,
		queryClient,
		onFollowFK,
		onFindReferences,
		onNavigateToReference,
		onNavigateToFK,
		onShowQuickReferences,
		onPrefetchReferences,
		onExpandToSheet,
		onMenuOpen,
	]);
};
