import { getTableColumnsQueryOptions } from "#src/server/introspection/start-fns/get-table-columns.start.ts";
import { useMemo } from "react";
import type { JoinedTable } from "./join-tables.types.ts";
import { useQueries } from "@tanstack/react-query";

export const useJoinedTables = (props: {
	url: string;
	joins: JoinedTable[];
}) => {
	// Fetch columns for each joined table
	const joinedTableColumnsQueries = useMemo(() => {
		return props.joins.map((join) =>
			getTableColumnsQueryOptions({
				url: props.url,
				schema: join.schema,
				table: join.table,
			}),
		);
	}, [props.joins, props.url]);

	return useQueries({ queries: joinedTableColumnsQueries });
};
