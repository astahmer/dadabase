import { getQueryHistoryQueryOptions } from "#src/server/pg/start-fns/get-query-history.start.ts";
import { clearQueryHistoryMutation } from "#src/server/query-logger/start-fns/clear-query-history.start.ts";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { QueryLogFilters } from "#src/server/query-logger/query-logger.types.ts";

interface UseQueryLoggerProps {
	connectionUrl: string;
}

export const useQueryLogger = ({ connectionUrl }: UseQueryLoggerProps) => {
	const [isOpen, setIsOpen] = useState(false);
	const [filters, setFilters] = useState<QueryLogFilters | undefined>();
	const queryClient = useQueryClient();

	const { data: history = [] } = useQuery(
		getQueryHistoryQueryOptions({ url: connectionUrl, filters }),
	);

	const clearMutation = useMutation({
		mutationFn: () => clearQueryHistoryMutation({ url: connectionUrl }),
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["app", "queryHistory"],
			});
		},
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
