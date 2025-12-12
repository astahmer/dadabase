import { useCallback, useState } from "react";
import type {
	JoinConditionMode,
	JoinedTable,
	JoinTablesConfig,
} from "./join-tables.types";

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

	const updateJoinConditionMode = useCallback(
		(table: string, schema: string, mode: JoinConditionMode) => {
			setConfig((prev) => ({
				...prev,
				joins: prev.joins.map((j) => {
					if (j.table === table && j.schema === schema) {
						const currentMode = j.joinCondition.mode;
						// If switching modes, preserve FK info but may reset custom conditions
						if (currentMode === mode) return j;

						if (mode === "standard" && currentMode === "custom") {
							// Switch to standard - keep original FK data if available
							return {
								...j,
								joinCondition: {
									mode: "standard",
									referencingColumn: j.joinCondition.referencingColumn ?? "",
									referencedColumn: j.joinCondition.referencedColumn ?? "",
								},
							};
						} else if (mode === "custom" && currentMode === "standard") {
							// Switch to custom - preserve FK info
							return {
								...j,
								joinCondition: {
									mode: "custom",
									referencingColumn: j.joinCondition.referencingColumn,
									referencedColumn: j.joinCondition.referencedColumn,
									conditions: [],
								},
							};
						}
					}
					return j;
				}),
			}));
		},
		[],
	);

	const updateCustomJoinConditions = useCallback(
		(table: string, schema: string, conditions: string[]) => {
			setConfig((prev) => ({
				...prev,
				joins: prev.joins.map((j) => {
					if (j.table === table && j.schema === schema) {
						if (j.joinCondition.mode === "custom") {
							return {
								...j,
								joinCondition: {
									...j.joinCondition,
									conditions,
								},
							};
						}
					}
					return j;
				}),
			}));
		},
		[],
	);

	const hasJoins = config.joins.length > 0;

	return {
		config: config,
		setConfig: setConfig,
		add: add,
		remove: remove,
		update: update,
		updateJoinConditionMode,
		updateCustomJoinConditions,
		clear: clear,
		hasJoins,
	};
};

export type UseJoinTablesStateReturn = ReturnType<typeof useJoinTablesState>;
