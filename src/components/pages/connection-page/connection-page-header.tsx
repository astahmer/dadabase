import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Database, Minimize2, RefreshCw } from "lucide-react";

import { getStoredPageLimit } from "#src/lib/default-page-limit.ts";

import { Button } from "../../ui/button";
import { DarkModeToggle } from "../../ui/dark-mode-toggle";
import { Tooltip } from "../../ui/tooltip.tsx";
import { useZenModeActions, useZenModeEnabled } from "./use-zen-mode.ts";

interface ConnectionPageHeaderProps {
  onAddConnection: () => void;
  onOpenSchemaExplorer?: () => void;
}

export const ConnectionPageHeader = (_props: ConnectionPageHeaderProps) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate({ from: "/connections/$connectionName" });
  const zenMode = useZenModeEnabled();
  const { toggleZenMode } = useZenModeActions();

  if (zenMode) return null;

  return (
    <div className="bg-card flex shrink-0 items-center justify-end gap-1 border-b px-3 py-1.5 sm:px-4">
      <Tooltip content="Zen mode (⌘.)">
        <Button variant="ghost" size="icon" onClick={toggleZenMode} aria-label="Enter zen mode">
          <Minimize2 className="h-3.5 w-3.5" />
        </Button>
      </Tooltip>
      <Tooltip content="Schema Explorer">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            navigate({
              search: (prev) => ({
                ...prev,
                schemaExplorerOpen: true,
              }),
            });
          }}
        >
          <Database className="h-3.5 w-3.5" />
        </Button>
      </Tooltip>
      <Tooltip content="Reset page">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            navigate({
              search: (prev) => {
                return {
                  dbName: prev.dbName,
                  schema: undefined,
                  table: undefined,
                  viewMode: undefined,
                  tableSize: undefined,
                  tableFilter: undefined,
                  hiddenColumnList: [],
                  filters: undefined,
                  filtersOpened: false,
                  offset: 0,
                  limit: getStoredPageLimit(),
                  orderBy: undefined,
                  orderDirection: undefined,
                  relationshipRowId: undefined,
                  quickReferencesCellValue: undefined,
                  quickReferencesColumnName: undefined,
                  quickReferencesOpen: false,
                  tabs: [],
                  activeTabId: undefined,
                };
              },
            });
          }}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </Tooltip>
      <Tooltip content="Refetch all">
        <Button
          variant="outline"
          size="icon"
          onClick={() => {
            queryClient.invalidateQueries();
          }}
          className="shrink-0"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </Tooltip>
      <DarkModeToggle />
    </div>
  );
};
