import { useCallback, useState } from "react";

import type { JoinConditionMode, JoinedTable, JoinTablesConfig } from "./join-tables.types";

import { cascadeRemoveJoins } from "./cascade-remove-joins.ts";

/**
 * Manages join tables configuration state
 */
export const useJoinTablesState = (parentTable: string, initialConfig?: JoinTablesConfig) => {
  const [config, setConfig] = useState<JoinTablesConfig>(() => initialConfig ?? { joins: [] });

  const add = useCallback(
    (join: JoinedTable) => {
      let alias: string | undefined;
      if (join.table === parentTable && join.joinCondition.referencedColumn) {
        alias = join.joinCondition.referencedColumn.replace(/_id$/, "");
      }
      setConfig((prev) => ({
        ...prev,
        joins: [
          ...prev.joins.filter((j) => !(j.table === join.table && j.schema === join.schema)),
          { ...join, alias: alias || join.alias },
        ],
      }));
    },
    [parentTable],
  );

  const remove = useCallback((table: string, schema: string) => {
    setConfig((prev) => {
      const { joins } = cascadeRemoveJoins({
        joins: prev.joins,
        remove: { schema, table },
      });
      return {
        ...prev,
        joins,
      };
    });
  }, []);

  const update = useCallback((table: string, schema: string, updates: Partial<JoinedTable>) => {
    setConfig((prev) => ({
      ...prev,
      joins: prev.joins.map((j) =>
        j.table === table && j.schema === schema ? { ...j, ...updates } : j,
      ),
    }));
  }, []);

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
            } else if (mode === "filters") {
              // Switch to filters - preserve FK info for fallback
              return {
                ...j,
                joinCondition: {
                  mode: "filters",
                  referencingColumn: j.joinCondition.referencingColumn,
                  referencedColumn: j.joinCondition.referencedColumn,
                  filters: undefined,
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

  const reorder = useCallback((fromIndex: number, toIndex: number) => {
    setConfig((prev) => {
      const newJoins = Array.from(prev.joins);
      const [removed] = newJoins.splice(fromIndex, 1);
      newJoins.splice(toIndex, 0, removed);
      return { ...prev, joins: newJoins };
    });
  }, []);

  const hasJoins = config.joins.length > 0;

  return {
    config: config,
    setConfig: setConfig,
    add: add,
    remove: remove,
    update: update,
    updateJoinConditionMode,
    updateCustomJoinConditions,
    reorder,
    clear: clear,
    hasJoins,
  };
};

export type UseJoinTablesStateReturn = ReturnType<typeof useJoinTablesState>;
