import { getQueryHistoryQueryOptions } from "#src/server/pg/start-fns/get-query-history.start.ts";
import type { QueryLogFilters } from "#src/server/query-logger/query-logger.types.ts";
import { clearQueryHistoryQueryOptions } from "#src/server/query-logger/start-fns/clear-query-history.start.ts";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

interface UseQueryLoggerProps {
	connectionUrl: string;
}

export const useQueryLogger = ({ connectionUrl }: UseQueryLoggerProps) => {
	const [isOpen, setIsOpen] = useState(false);
	const [filters, setFilters] = useState<QueryLogFilters | undefined>();

	const { data: history = [] } = useQuery(
		getQueryHistoryQueryOptions({ url: connectionUrl, filters }),
	);

	const clearMutation = useQuery(
		clearQueryHistoryQueryOptions({ url: connectionUrl }),
	);

	return {
		history,
		isOpen,
		toggleOpen: () => {
			setIsOpen((prev) => !prev);
		},
		clearHistory: () => clearMutation.refetch(),
		filters,
		setFilters,
		isClearing: clearMutation.isLoading,
	};
};
