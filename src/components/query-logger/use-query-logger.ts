import { getQueryHistoryQueryOptions } from "#src/server/pg/start-fns/get-query-history.start.ts";
import type { QueryLogFilters } from "#src/server/query-logger/query-logger.types.ts";
import { clearQueryHistoryMutation } from "#src/server/query-logger/start-fns/clear-query-history.start.ts";
import { useMutation, useQuery } from "@tanstack/react-query";
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

	const clearMutation = useMutation({
		mutationFn: () => clearQueryHistoryMutation({ url: connectionUrl }),
	});

	const toggleOpen = () => {
		setIsOpen((prev) => !prev);
	};

	const clearHistory = async () => {
		await clearMutation.mutateAsync();
	};

	return {
		history,
		isOpen,
		toggleOpen,
		clearHistory,
		filters,
		setFilters,
		isClearing: clearMutation.isPending,
	};
};
