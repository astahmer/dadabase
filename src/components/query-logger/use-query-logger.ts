import { getQueryHistoryQueryOptions } from "#src/server/pg/start-fns/get-query-history.start.ts";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

export const useQueryLogger = () => {
	const [isOpen, setIsOpen] = useState(false);

	const { data: history = [] } = useQuery(getQueryHistoryQueryOptions());

	const toggleOpen = () => {
		setIsOpen((prev) => !prev);
	};

	const clearHistory = () => {
		// setHistory([]);
	};

	return {
		history,
		isOpen,
		toggleOpen,
		clearHistory,
	};
};
