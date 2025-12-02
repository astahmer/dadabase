import type { TableColumnMetadata } from "#src/server/introspection/introspection.ts";
import { getAllTablesColumnsQueryOptions } from "#src/server/pg/start-fns/get-all-tables-columns.start.ts";
import { getTableColumnsQueryOptions } from "#src/server/pg/start-fns/get-table-columns.start";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

interface UseTableColumnMetadataOptions {
	url: string;
	schema: string;
	table: string;
}

interface UseTableColumnMetadataResult {
	columnMetadata: Array<TableColumnMetadata>;
	columnList: string[];
	isLoading: boolean;
	isError: boolean;
	error: Error | null;
}

const useSingleTableColumnMetadata = ({
	url,
	schema,
	table,
}: UseTableColumnMetadataOptions): UseTableColumnMetadataResult => {
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

	const columnMetadata = useMemo(() => {
		if (!table || !schema) return [];
		if (singleTableMetadataQuery.data) {
			return singleTableMetadataQuery.data;
		}

		return [];
	}, [singleTableMetadataQuery.data, table, schema]);

	return {
		columnMetadata,
		columnList: columnMetadata.map((col) => col.name),
		isLoading: singleTableMetadataQuery.isLoading,
		isError: singleTableMetadataQuery.isError,
		error: singleTableMetadataQuery.error,
	};
};

export const useTableColumnMetadata = ({
	url,
	schema,
	table,
}: UseTableColumnMetadataOptions): UseTableColumnMetadataResult => {
	const singleMetadataQuery = useSingleTableColumnMetadata({
		url,
		schema,
		table,
	});
	const allTablesColumnsQuery = useQuery({
		...getAllTablesColumnsQueryOptions({ url, schema }),
		enabled: !!url && !!schema,
		// Longer stale time since this is comprehensive data fetched in background
		staleTime: 5 * 60 * 1000, // 5 minutes
	});

	const columnMetadata =
		singleMetadataQuery.columnMetadata ??
		(allTablesColumnsQuery.data ?? [])?.find((col) => col.table === table)
			?.columns ??
		[];

	return {
		columnMetadata: columnMetadata,
		columnList: columnMetadata.map((col) => col.name),
		isLoading: singleMetadataQuery.isLoading && allTablesColumnsQuery.isLoading,
		isError: singleMetadataQuery.isError && allTablesColumnsQuery.isError,
		error: singleMetadataQuery.error && allTablesColumnsQuery.error,
	};
};
