import { useCallback, useState } from "react";
import type { JoinTablesConfig, JoinedTable } from "./join-tables.types";

/**
 * Manages join tables configuration state
 */
export const useJoinTablesState = (initialConfig?: JoinTablesConfig) => {
	const [config, setConfig] = useState<JoinTablesConfig>(
		initialConfig ?? { joins: [] },
	);

	const add = useCallback((join: JoinedTable) => {
		setConfig((prev) => ({
			...prev,
			joins: [
				...prev.joins.filter(
					(j) => !(j.table === join.table && j.schema === join.schema),
				),
				join,
			],
		}));
	}, []);

	const remove = useCallback((table: string, schema: string) => {
		setConfig((prev) => ({
			...prev,
			joins: prev.joins.filter(
				(j) => !(j.table === table && j.schema === schema),
			),
		}));
	}, []);

	const update = useCallback(
		(table: string, schema: string, updates: Partial<JoinedTable>) => {
			setConfig((prev) => ({
				...prev,
				joins: prev.joins.map((j) =>
					j.table === table && j.schema === schema ? { ...j, ...updates } : j,
				),
			}));
		},
		[],
	);

	const clear = useCallback(() => {
		setConfig({ joins: [] });
	}, []);

	const hasJoins = config.joins.length > 0;

	return {
		config: config,
		setConfig: setConfig,
		add: add,
		remove: remove,
		update: update,
		clear: clear,
		hasJoins,
	};
};

export type UseJoinTablesStateReturn = ReturnType<typeof useJoinTablesState>;
