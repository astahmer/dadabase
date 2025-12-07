import { useCallback, useState } from "react";
import type { JoinTablesConfig, JoinedTable } from "./join-tables.types";

/**
 * Manages join tables configuration state
 */
export const useJoinTablesState = (initialConfig?: JoinTablesConfig) => {
	const [joinConfig, setJoinConfig] = useState<JoinTablesConfig>(
		initialConfig ?? { joins: [] },
	);

	const addJoin = useCallback((join: JoinedTable) => {
		setJoinConfig((prev) => ({
			...prev,
			joins: [
				...prev.joins.filter(
					(j) => !(j.table === join.table && j.schema === join.schema),
				),
				join,
			],
		}));
	}, []);

	const removeJoin = useCallback((table: string, schema: string) => {
		setJoinConfig((prev) => ({
			...prev,
			joins: prev.joins.filter(
				(j) => !(j.table === table && j.schema === schema),
			),
		}));
	}, []);

	const updateJoin = useCallback(
		(table: string, schema: string, updates: Partial<JoinedTable>) => {
			setJoinConfig((prev) => ({
				...prev,
				joins: prev.joins.map((j) =>
					j.table === table && j.schema === schema ? { ...j, ...updates } : j,
				),
			}));
		},
		[],
	);

	const clearJoins = useCallback(() => {
		setJoinConfig({ joins: [] });
	}, []);

	const hasJoins = joinConfig.joins.length > 0;

	return {
		joinConfig,
		setJoinConfig,
		addJoin,
		removeJoin,
		updateJoin,
		clearJoins,
		hasJoins,
	};
};

export type UseJoinTablesStateReturn = ReturnType<typeof useJoinTablesState>;
