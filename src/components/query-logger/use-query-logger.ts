import { getQueryHistoryQueryOptions } from "#src/server/pg/start-fns/get-query-history.start.ts";
import type { QueryLogEntryType } from "#src/server/query-logger/query-logger.types.ts";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";

export const useQueryLogger = () => {
	const queryClient = useQueryClient();
	const [history, setHistory] = useState<QueryLogEntryType[]>([]);
	const [isOpen, setIsOpen] = useState(false);

	// Query the server for query history
	const { data } = useQuery(getQueryHistoryQueryOptions());

	useEffect(() => {
		if (data) {
			setHistory(data);
		}
	}, [data]);

	const toggleOpen = useCallback(() => {
		setIsOpen((prev) => !prev);
	}, []);

	const clearHistory = useCallback(() => {
		setHistory([]);
	}, []);

	// Function to invalidate query history (called after mutations)
	const invalidateQueryHistory = useCallback(() => {
		queryClient.invalidateQueries(getQueryHistoryQueryOptions());
	}, [queryClient]);

	return {
		history,
		isOpen,
		toggleOpen,
		clearHistory,
		invalidateQueryHistory,
	};
};
