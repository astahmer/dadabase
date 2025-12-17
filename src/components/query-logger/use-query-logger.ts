import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getQueryHistoryQueryOptions } from "#src/server/introspection/start-fns/get-query-history.start.ts";
import {
	QueryLogLevel,
	type QueryLogFilters,
} from "#src/server/query-logger/query-logger.types.ts";
import { clearQueryHistoryQueryOptions } from "#src/server/query-logger/start-fns/clear-query-history.start.ts";

interface UseQueryLoggerProps {
	connectionUrl: string;
}

export const useQueryLogger = ({ connectionUrl }: UseQueryLoggerProps) => {
	const [isOpen, setIsOpen] = useState(false);
	const [filters, setFilters] = useState<QueryLogFilters | undefined>({
		level: QueryLogLevel.Info,
	});

	const historyQuery = useQuery(
		getQueryHistoryQueryOptions({ url: connectionUrl, filters }),
	);

	const clearMutation = useQuery(
		clearQueryHistoryQueryOptions({ url: connectionUrl }),
	);

	return {
		history: historyQuery.data?.logs ?? [],
		counts: historyQuery.data?.counts ?? { success: 0, pending: 0, error: 0 },
		isOpen,
		toggleOpen: () => {
			setIsOpen((prev) => !prev);
		},
		clearHistory: () => {
			clearMutation.refetch().then(() => historyQuery.refetch());
		},
		filters,
		setFilters,
		isClearing: clearMutation.isLoading,
	};
};
