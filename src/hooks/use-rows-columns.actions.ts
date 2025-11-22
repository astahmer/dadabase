import type { ForeignKeyInfo } from "#src/components/cell-context-menu.tsx";
import { findColumnReferencesWithCountsQueryOptions } from "#src/server/pg/start-fns/find-column-references.start.ts";
import { useCallback } from "react";
import type { UseRowsColumnsOptions } from "./use-rows-columns.tsx";
import type { TableColumnMetadata } from "#src/server/pg/fns/get-table-columns.kysely.ts";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { createTabState } from "#src/components/pages/connection-page/create-tab-state.ts";

interface UseRowsColumnsActionOptions {
	columnMetadata: TableColumnMetadata[];
	selectedSchema: string;
	selectedTable: string;
	activeConnectionUrl: string;
}

// TODO move out folder
export const useRowsColumnsAction = (props: UseRowsColumnsActionOptions) => {
	const { columnMetadata, selectedSchema, selectedTable, activeConnectionUrl } =
		props;

	const queryClient = useQueryClient();
	const navigate = useNavigate({ from: "/connections/$connectionName" });

	const handleFollowFK = useCallback(
		(fkInfo: ForeignKeyInfo, cellValue: unknown) => {
			const newTabState = createTabState(
				fkInfo.referencedSchema,
				fkInfo.referencedTable,
				{
					filters: {
						conditions: [
							{
								column: fkInfo.referencedColumn,
								operator: "equals",
								value: String(cellValue),
							},
						],
						logicalOperator: "and",
					},
					filtersOpened: true,
					fkValue: String(cellValue),
				},
			);
			navigate({
				search: (prev) => ({
					...prev,
					schema: fkInfo.referencedSchema,
					table: fkInfo.referencedTable,
					activeTabId: newTabState.tabId,
					tabs: [...(prev.tabs ?? []), newTabState],
					filters: {
						conditions: [
							{
								column: fkInfo.referencedColumn,
								operator: "equals",
								value: String(cellValue),
							},
						],
						logicalOperator: "and",
					},
					filtersOpened: true,
					offset: 0,
					limit: 50,
					orderBy: undefined,
					orderDirection: undefined,
					relationshipRowId: undefined,
				}),
			});
		},
		[navigate],
	);

	const handleFindReferences = useCallback(
		(columnName: string, cellValue: unknown) => {
			navigate({
				search: (prev) => ({
					...prev,
					filtersOpened: true,
					filters: {
						conditions: [
							{
								column: columnName,
								operator: "equals",
								value: String(cellValue),
							},
						],
						logicalOperator: "and",
					},
					offset: 0,
				}),
			});
		},
		[navigate],
	);

	const handleNavigateToReference = useCallback(
		(
			ref: { schema: string; table: string; column: string },
			cellValue: unknown,
		) => {
			const newTabState = createTabState(ref.schema, ref.table, {
				filters: {
					conditions: [
						{
							column: ref.column,
							operator: "equals",
							value: String(cellValue),
						},
					],
					logicalOperator: "and",
				},
				filtersOpened: true,
				fkValue: String(cellValue),
			});
			navigate({
				search: (prev) => ({
					...prev,
					schema: ref.schema,
					table: ref.table,
					activeTabId: newTabState.tabId,
					tabs: [...(prev.tabs ?? []), newTabState],
					filters: {
						conditions: [
							{
								column: ref.column,
								operator: "equals",
								value: String(cellValue),
							},
						],
						logicalOperator: "and",
					},
					filtersOpened: true,
					offset: 0,
					limit: 50,
					orderBy: undefined,
					orderDirection: undefined,
					relationshipRowId: undefined,
				}),
			});
		},
		[navigate],
	);

	const actions = {
		onFollowFK: handleFollowFK,
		onFindReferences: handleFindReferences,
		onShowQuickReferences: (columnName, cellValue) => {
			navigate({
				search: (prev) => ({
					...prev,
					quickReferencesOpen: true,
					quickReferencesColumnName: columnName,
					quickReferencesCellValue: String(cellValue),
				}),
			});
		},
		onPrefetchReferences: (columnName, cellValue) => {
			const col = columnMetadata.find((c) => c.name === columnName);
			const referenceTarget = col?.foreignKey
				? {
						referencedSchema: col.foreignKey.referencedSchema,
						referencedTable: col.foreignKey.referencedTable,
						referencedColumn: col.foreignKey.referencedColumn,
					}
				: {
						referencedSchema: selectedSchema,
						referencedTable: selectedTable,
						referencedColumn: columnName,
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
		},
		onNavigateToFK: handleFollowFK,
		onNavigateToReference: handleNavigateToReference,
		onExpandToSheet: (columnName, cellValue) => {
			navigate({
				search: (prev) => ({
					...prev,
					quickReferencesOpen: true,
					quickReferencesColumnName: columnName,
					quickReferencesCellValue: String(cellValue),
				}),
			});
		},
		onMenuOpen: (columnName, cellValue) => {
			const col = columnMetadata.find((c) => c.name === columnName);
			const referenceTarget = col?.foreignKey
				? {
						referencedSchema: col.foreignKey.referencedSchema,
						referencedTable: col.foreignKey.referencedTable,
						referencedColumn: col.foreignKey.referencedColumn,
					}
				: {
						referencedSchema: selectedSchema,
						referencedTable: selectedTable,
						referencedColumn: columnName,
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
		},
	} satisfies Partial<UseRowsColumnsOptions>;

	return actions;
};
