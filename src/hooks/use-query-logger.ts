import { useQuery } from "@tanstack/react-query";
import { useState, useCallback, useEffect } from "react";
import type { QueryLogEntry } from "#src/lib/query-logger.types.ts";
import { getQueryHistoryServerFn } from "#src/server/pg/start-fns/get-query-history.start.ts";

export const useQueryLogger = () => {
	const [history, setHistory] = useState<QueryLogEntry[]>([]);
	const [isOpen, setIsOpen] = useState(false);

	// Poll the server for query history updates
	const { data } = useQuery({
		queryKey: ["queryHistory"],
		queryFn: async () => getQueryHistoryServerFn(),
		refetchInterval: 500, // Poll every 500ms for real-time updates
		refetchIntervalInBackground: true,
	});

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

	return {
		history,
		isOpen,
		toggleOpen,
		clearHistory,
	};
};
