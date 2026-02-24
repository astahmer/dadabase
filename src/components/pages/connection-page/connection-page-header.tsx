import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Database, RefreshCw } from "lucide-react";

import { Button } from "../../ui/button";
import { DarkModeToggle } from "../../ui/dark-mode-toggle";
import { Tooltip } from "../../ui/tooltip.tsx";

interface ConnectionPageHeaderProps {
  onAddConnection: () => void;
  onOpenSchemaExplorer?: () => void;
}

export const ConnectionPageHeader = (props: ConnectionPageHeaderProps) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate({ from: "/connections/$connectionName" });

  return (
    <div className="bg-card flex shrink-0 items-center justify-end gap-1 border-b px-3 py-1.5 sm:px-4">
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
                  limit: 50,
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
