import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { getAllTablesColumnsQueryOptions } from "#src/server/pg/start-fns/get-all-tables-columns.start";
import { getTableColumnsQueryOptions } from "#src/server/pg/start-fns/get-table-columns.start";

interface UseTableColumnMetadataOptions {
	url: string;
	schema: string;
	table: string;
}

interface UseTableColumnMetadataResult {
	columnMetadata: Array<{
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
	}>;
	columnList: string[];
	isLoading: boolean;
	isError: boolean;
	error: Error | null;
}

/**
 * Custom hook for fetching table column metadata with hybrid strategy:
 * - Fetches single table metadata immediately for fast initial load
 * - Fetches all tables metadata in background for efficient navigation caching
 * - Automatically prefers all-tables data once available
 *
 * This strategy provides:
 * - Fast initial load (single table query starts immediately)
 * - Instant subsequent navigations (uses cached all-tables data)
 * - No redundant fetching on navigation
 */
export const useTableColumnMetadata = ({
	url,
	schema,
	table,
}: UseTableColumnMetadataOptions): UseTableColumnMetadataResult => {
	// Fetch all tables' columns in the background (for cache on navigation)
	// Strategy: We fetch all table metadata in the background while showing the user
	// data for their currently selected table. This way:
	// 1. Initial load is fast (single table query starts immediately)
	// 2. Subsequent table navigations in the same schema are instant (from all-tables cache)
	// 3. No redundant fetching on navigation since all data is already in the cache
	const allTablesColumnsQuery = useQuery({
		...getAllTablesColumnsQueryOptions({
			url,
			schema,
		}),
		enabled: !!url && !!schema,
		// Longer stale time since this is comprehensive data fetched in background
		staleTime: 5 * 60 * 1000, // 5 minutes
	});

	// Fetch only the current table's columns (fast path for initial load)
	// This enables quick initial rendering while allTablesColumnsQuery is fetching in parallel.
	// Once allTablesColumnsQuery completes, we switch to using its data for better performance.
	const singleTableMetadataQuery = useQuery({
		...getTableColumnsQueryOptions({
			url,
			schema,
			table,
		}),
		enabled: !!url && !!schema && !!table,
		// Shorter stale time since this is just a fallback while allTables data loads
		staleTime: 60 * 1000, // 1 minute
	});

	// Get metadata for the currently selected table
	// Strategy: Prefer all-tables data (background cache), fall back to single-table data (fast)
	// This gives us:
	// - Fast initial load: singleTableMetadataQuery data shows up immediately
	// - Optimal caching: Once allTablesColumnsQuery finishes, we use its data for all navigations
	// - No redundant requests: Navigating to another table in the same schema hits the cache
	const columnMetadata = useMemo(() => {
		if (!table || !schema) return [];

		// Prefer all tables data if available (from background fetch)
		// This ensures we use the comprehensive cached data for all table navigations
		if (allTablesColumnsQuery.data) {
			const tableData = allTablesColumnsQuery.data.find(
				(t) => t.table === table,
			);
			if (tableData?.columns) {
				return tableData.columns;
			}
		}

		// Fall back to single table metadata (faster initial load while waiting for all tables)
		// This is only used until the all-tables query completes
		if (singleTableMetadataQuery.data) {
			return singleTableMetadataQuery.data;
		}

		return [];
	}, [
		allTablesColumnsQuery.data,
		singleTableMetadataQuery.data,
		table,
		schema,
	]);

	// Determine loading and error states
	const isLoading =
		allTablesColumnsQuery.isLoading || singleTableMetadataQuery.isLoading;
	const isError =
		allTablesColumnsQuery.isError || singleTableMetadataQuery.isError;
	const error = allTablesColumnsQuery.error || singleTableMetadataQuery.error;

	const columnList = useMemo(
		() => columnMetadata.map((col) => col.name),
		[columnMetadata],
	);

	return {
		columnMetadata,
		columnList,
		isLoading,
		isError,
		error: error ?? null,
	};
};
