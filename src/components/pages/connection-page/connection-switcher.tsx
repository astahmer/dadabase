import { createListCollection } from "@ark-ui/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  ChevronLeftIcon,
  DatabaseIcon,
  History,
  LucidePlus,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Star,
} from "lucide-react";
import { useState } from "react";

import { DarkModeToggle } from "#src/components/ui/dark-mode-toggle.tsx";
import { ListboxMenu } from "#src/components/ui/listbox-menu.export.ts";
import { getStoredPageLimit } from "#src/lib/default-page-limit.ts";
import { redactConnectionUrl } from "#src/lib/redact-connection-url.ts";
import { queryClient } from "#src/query-client.ts";
import { listDbConnectionQueryOptions } from "#src/server/db-connection/start-fns/list-db-connection.start.ts";

import type { DbConnection } from "../connection.types";

import { Button } from "../../ui/button";
import { HStack, Stack } from "../../ui/layout.tsx";
import { Tooltip } from "../../ui/tooltip.tsx";

interface ConnectionSwitcherProps {
  connection: DbConnection;
  onAddConnection: () => void;
  onOpenAiAssistant?: () => void;
  onOpenHistory?: () => void;
  onOpenFavorites?: () => void;
}

const railBtnClass =
  "text-muted-foreground hover:text-foreground h-9 w-9 shrink-0 rounded-md shadow-none";

export const ConnectionSwitcher = (props: ConnectionSwitcherProps) => {
  const { connection } = props;
  const [connectionMenuOpen, setConnectionMenuOpen] = useState(false);

  const navigate = useNavigate({ from: "/connections/$connectionName" });
  const connectionList = useSuspenseQuery(listDbConnectionQueryOptions);
  const connectionName = connection.name;
  const redactedUrl = redactConnectionUrl(connection.url);

  const resetPage = () => {
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
  };

  return (
    <Stack className="border-border h-full w-11 shrink-0 items-center gap-1 border-r py-2" gap="1">
      <ListboxMenu.ListboxMenuRoot
        open={connectionMenuOpen}
        onOpenChange={(details) => {
          setConnectionMenuOpen(details.open);
        }}
      >
        <Tooltip
          content={`${connection.name} — ${redactedUrl}`}
          positioning={{ placement: "right" }}
        >
          <ListboxMenu.ListboxMenuTrigger variant="unstyled" size="unstyled" asChild>
            <Button
              variant="ghost"
              size="icon"
              className={railBtnClass}
              aria-label="Switch connection"
            >
              <DatabaseIcon className="h-4 w-4" />
            </Button>
          </ListboxMenu.ListboxMenuTrigger>
        </Tooltip>
        <ListboxMenu.ListboxMenuContent>
          <ListboxMenu.ListboxRoot
            collection={createListCollection({
              items: connectionList.data.map((conn) => ({
                label: conn.name,
                value: conn.name,
              })),
            })}
            onValueChange={(details) => {
              if (details.value && details.value[0] !== connectionName) {
                setConnectionMenuOpen(false);
                navigate({
                  to: "/connections/$connectionName",
                  params: { connectionName: details.value[0] },
                });
              }
            }}
          >
            <ListboxMenu.ListboxMenuList>
              <ListboxMenu.ListboxMenuItem
                item={{ label: "Back to connections", value: "__back" }}
                onClick={() => {
                  setConnectionMenuOpen(false);
                  navigate({
                    to: "/",
                  });
                }}
              >
                <HStack gap="1" align="center">
                  <ChevronLeftIcon className="text-muted-foreground h-3 w-3 shrink-0" />
                  <span>Back to connections</span>
                </HStack>
              </ListboxMenu.ListboxMenuItem>
              {connectionList.data.map((conn) => (
                <ListboxMenu.ListboxMenuItem
                  key={conn.name}
                  item={{ label: conn.name, value: conn.name }}
                  showIndicator={conn.name === connectionName}
                  className={
                    conn.name === connectionName
                      ? "bg-primary/15 text-primary hover:bg-primary/20 font-semibold"
                      : ""
                  }
                >
                  {conn.name}
                </ListboxMenu.ListboxMenuItem>
              ))}
              <div className="border-t" />
              <ListboxMenu.ListboxMenuItem
                item={{ label: "Add new connection", value: "__add" }}
                onClick={() => {
                  setConnectionMenuOpen(false);
                  props.onAddConnection();
                }}
              >
                <HStack gap="1" align="center">
                  <LucidePlus className="h-3 w-3" />
                  <span>Add new connection</span>
                </HStack>
              </ListboxMenu.ListboxMenuItem>
            </ListboxMenu.ListboxMenuList>
          </ListboxMenu.ListboxRoot>
        </ListboxMenu.ListboxMenuContent>
      </ListboxMenu.ListboxMenuRoot>

      <Tooltip content="Toggle theme" positioning={{ placement: "right" }}>
        <DarkModeToggle variant="ghost" size="icon" className={railBtnClass} />
      </Tooltip>

      <Tooltip content="Refetch all" positioning={{ placement: "right" }}>
        <Button
          size="icon"
          variant="ghost"
          className={railBtnClass}
          aria-label="Refetch all"
          onClick={() => {
            queryClient.invalidateQueries();
          }}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </Tooltip>

      <Tooltip content="Reset page" positioning={{ placement: "right" }}>
        <Button
          size="icon"
          variant="ghost"
          className={railBtnClass}
          aria-label="Reset page"
          onClick={resetPage}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
      </Tooltip>

      {props.onOpenFavorites && (
        <Tooltip content="Saved queries" positioning={{ placement: "right" }}>
          <Button
            size="icon"
            variant="ghost"
            className={railBtnClass}
            aria-label="Saved queries"
            onClick={props.onOpenFavorites}
          >
            <Star className="h-4 w-4" />
          </Button>
        </Tooltip>
      )}

      {props.onOpenHistory && (
        <Tooltip content="Query history" positioning={{ placement: "right" }}>
          <Button
            size="icon"
            variant="ghost"
            className={railBtnClass}
            aria-label="Query history"
            onClick={props.onOpenHistory}
          >
            <History className="h-4 w-4" />
          </Button>
        </Tooltip>
      )}

      {props.onOpenAiAssistant && (
        <Tooltip content="AI assistant (BYOK)" positioning={{ placement: "right" }}>
          <Button
            size="icon"
            variant="ghost"
            className={railBtnClass}
            aria-label="Open AI assistant"
            onClick={props.onOpenAiAssistant}
          >
            <Sparkles className="h-4 w-4" />
          </Button>
        </Tooltip>
      )}
    </Stack>
  );
};
