import type { LucideIcon } from "lucide-react";

import { Clipboard, Portal } from "@ark-ui/react";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  CheckIcon,
  ClipboardIcon,
  EllipsisIcon,
  LucideAlertCircle,
  LucideCheck,
  LucideCloud,
  LucideFileText,
  LucidePenLine,
  LucidePlus,
  LucideStar,
  LucideWifi,
  LucideZap,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { DatabaseDialect } from "#src/db/dialect.ts";

import { useDocumentTitle } from "#src/hooks/use-document-title.ts";
import { useLocalStorage } from "#src/hooks/use-local-storage.ts";
import { isReadOnlyConnection } from "#src/lib/connection-security.ts";
import { copyToClipboard } from "#src/lib/data-export/index.ts";
import { redactConnectionUrl } from "#src/lib/redact-connection-url.ts";
import { deleteDbConnectionMutation } from "#src/server/db-connection/start-fns/delete-db-connection.start.ts";
import { listDbConnectionQueryOptions } from "#src/server/db-connection/start-fns/list-db-connection.start.ts";
import { tryConnectionServerFn } from "#src/server/introspection/start-fns/try-connection.start.ts";

import { DataTable } from "../data-table/data-table.tsx";
import { useDataTable } from "../data-table/use-data-table.ts";
import { AlertDialog } from "../ui/alert-dialog.tsx";
import { Badge } from "../ui/badge.tsx";
import { Button } from "../ui/button.tsx";
import { DarkModeToggle } from "../ui/dark-mode-toggle.tsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog.tsx";
import { Input } from "../ui/input.tsx";
import { HStack } from "../ui/layout.tsx";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "../ui/menu.tsx";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../ui/sheet.tsx";
import { toaster } from "../ui/toaster.tsx";
import { Tooltip } from "../ui/tooltip.tsx";
import { ConnectionForm } from "./connection.form.tsx";

interface EditableConnection {
  id: string;
  name: string;
  url: string;
  dialect: DatabaseDialect;
  created_at: number;
  updated_at: number;
}

interface ConnectionHealth {
  status: "success" | "failure";
  checkedAt: number;
}

function getEndpointLabel(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "file:") {
      const filename = parsed.pathname.split("/").filter(Boolean).at(-1) || "SQLite file";
      return `Local file · ${filename}`;
    }
  } catch {
    // Fall back to the safe display value below.
  }

  return redactConnectionUrl(url);
}

/** H17: split a file-path URL into basename + ellipsized parent for table cells. */
function getEndpointPathParts(url: string): { basename: string; parent: string } | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "file:") return null;
    const segments = decodeURIComponent(parsed.pathname).split("/").filter(Boolean);
    if (segments.length === 0) return null;
    const basename = segments.at(-1) ?? "";
    const parent = segments.slice(0, -1).join("/");
    return { basename, parent: parent ? `…/${parent}` : "/" };
  } catch {
    return null;
  }
}

/** H4: capitalized display labels + icons for dialect scanning. */
const DIALECT_META: Record<DatabaseDialect, { label: string; Icon: LucideIcon }> = {
  postgres: { label: "Postgres", Icon: LucideCloud },
  mysql: { label: "MySQL / MariaDB", Icon: LucideCloud },
  sqlite: { label: "SQLite", Icon: LucideFileText },
  libsql: { label: "libSQL / Turso", Icon: LucideCloud },
  duckdb: { label: "DuckDB", Icon: LucideZap },
  csv: { label: "CSV files", Icon: LucideFileText },
  mssql: { label: "SQL Server", Icon: LucideCloud },
  clickhouse: { label: "ClickHouse", Icon: LucideZap },
};

function ConnectionActions({
  connection,
  onOpen,
  health,
  onHealthChange,
}: {
  connection: EditableConnection;
  onOpen: (connectionName: string) => void;
  health?: ConnectionHealth;
  onHealthChange: (connectionId: string, health: ConnectionHealth) => void;
}) {
  const testConnection = useServerFn(tryConnectionServerFn);
  const [state, setState] = useState<"idle" | "success" | "failure">(health?.status ?? "idle");

  const testConnectionUrl = async () => {
    const result = await testConnection({
      data: { url: connection.url, dialect: connection.dialect },
    });

    if (result.success) {
      setState("success");
      onHealthChange(connection.id, { status: "success", checkedAt: Date.now() });
      toaster.create({
        title: (
          <HStack align="center" className="text-chart-2">
            <LucideCheck className="h-3 w-3" />
            Connection successful
          </HStack>
        ),
        description: "You can open this connection now.",
      });
      return;
    }

    setState("failure");
    onHealthChange(connection.id, { status: "failure", checkedAt: Date.now() });
    toaster.create({
      title: (
        <HStack align="center" className="text-chart-1">
          <LucideAlertCircle className="h-3 w-3" />
          Connection failed
        </HStack>
      ),
      description: result.message,
    });
  };

  return (
    <HStack className="justify-end gap-2">
      <Button
        variant="outline"
        size="sm"
        aria-label={`Test ${connection.name}`}
        onClick={() => void testConnectionUrl()}
      >
        {state === "idle" ? (
          <>
            <LucideWifi className="h-4 w-4" />
            Test
          </>
        ) : state === "success" ? (
          <>
            <LucideCheck className="text-chart-2 h-4 w-4" />
            Working
          </>
        ) : (
          <>
            <LucideAlertCircle className="text-chart-1 h-4 w-4" />
            Failed
          </>
        )}
      </Button>
      <Link
        to="/connections/$connectionName"
        params={{ connectionName: connection.name }}
        onClick={() => onOpen(connection.name)}
      >
        <Button size="sm">Open</Button>
      </Link>
    </HStack>
  );
}

function ConnectionRowMenu({
  connection,
  onEdit,
  isFavorite,
  onToggleFavorite,
}: {
  connection: EditableConnection;
  onEdit: (connection: EditableConnection) => void;
  isFavorite: boolean;
  onToggleFavorite: (connectionName: string) => void;
}) {
  const deleteMutation = useMutation(deleteDbConnectionMutation);

  return (
    <Menu>
      <MenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="rounded-full shadow-none"
          aria-label={`Open actions for ${connection.name}`}
        >
          <EllipsisIcon size={16} aria-hidden="true" />
        </Button>
      </MenuTrigger>
      <Portal>
        <MenuContent>
          <MenuItem
            value="favorite"
            onClick={() => onToggleFavorite(connection.name)}
            data-testid={`connection-favorite-${connection.name}`}
          >
            <LucideStar
              size={14}
              className={isFavorite ? "fill-warning text-warning" : ""}
              aria-hidden="true"
            />
            {isFavorite ? "Remove from favorites" : "Add to favorites"}
          </MenuItem>
          <MenuItem value="edit" onClick={() => onEdit(connection)}>
            Edit connection
          </MenuItem>
          <AlertDialog
            trigger={<MenuItem value="copy-with-credentials">Copy URL with credentials</MenuItem>}
            title={`Copy credentials for ${connection.name}?`}
            description="This copies the full connection URL, including its password, to the clipboard. Anyone with clipboard access can use it."
            onConfirm={() => {
              void copyToClipboard(connection.url).then((success) => {
                toaster.create({
                  title: success ? "Connection URL copied" : "Could not copy connection URL",
                  description: success
                    ? "The full URL is now in your clipboard."
                    : "Clipboard access was denied.",
                  type: success ? "success" : "error",
                });
              });
            }}
          />
          <AlertDialog
            trigger={<MenuItem value="delete">Delete connection</MenuItem>}
            title={`Delete ${connection.name}?`}
            description="This removes the saved connection from Dadabase. It does not affect the database."
            onConfirm={() => {
              void deleteMutation.mutateAsync({ data: { id: connection.id } });
            }}
          />
        </MenuContent>
      </Portal>
    </Menu>
  );
}

/** H3 storage defaults must be referentially stable — useLocalStorage re-runs its
 *  load effect whenever the fallback identity changes. */
const NO_FAVORITES: string[] = [];
const NEVER_OPENED: Record<string, number> = {};
const NO_HEALTH: Record<string, ConnectionHealth> = {};

export const HomePage = () => {
  useDocumentTitle("Connections — Dadabase");
  const [editingConnection, setEditingConnection] = useState<EditableConnection | null>(null);
  const [connectionSearch, setConnectionSearch] = useState("");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [favorites, setFavorites] = useLocalStorage<string[]>(
    "dadabase.favorite-connections",
    NO_FAVORITES,
  );
  const favoriteNames = favorites ?? NO_FAVORITES;
  const [lastOpened, setLastOpened] = useLocalStorage<Record<string, number>>(
    "dadabase.connection-last-opened",
    NEVER_OPENED,
  );
  const lastOpenedMap = lastOpened ?? NEVER_OPENED;
  const [healthByConnectionId, setHealthByConnectionId] = useLocalStorage<
    Record<string, ConnectionHealth>
  >("dadabase.connection-health", NO_HEALTH);
  const connectionHealth = healthByConnectionId ?? NO_HEALTH;

  const savedDatabaseList = useSuspenseQuery(listDbConnectionQueryOptions);
  const normalizedSearch = connectionSearch.trim().toLocaleLowerCase();
  const visibleConnections = useMemo(
    () =>
      savedDatabaseList.data
        .filter((connection) => {
          if (!normalizedSearch) return true;
          return [connection.name, connection.dialect, getEndpointLabel(connection.url)]
            .join(" ")
            .toLocaleLowerCase()
            .includes(normalizedSearch);
        })
        // H3: favorites first, then most-recently opened, then name.
        .toSorted((a, b) => {
          const favoriteDelta =
            Number(favoriteNames.includes(b.name)) - Number(favoriteNames.includes(a.name));
          if (favoriteDelta !== 0) return favoriteDelta;
          const recencyDelta = (lastOpenedMap[b.name] ?? 0) - (lastOpenedMap[a.name] ?? 0);
          if (recencyDelta !== 0) return recencyDelta;
          return a.name.localeCompare(b.name);
        }),
    [normalizedSearch, savedDatabaseList.data, favoriteNames, lastOpenedMap],
  );

  const recordOpened = (connectionName: string) => {
    setLastOpened({ ...lastOpenedMap, [connectionName]: Date.now() });
  };

  const toggleFavorite = (connectionName: string) => {
    setFavorites(
      favoriteNames.includes(connectionName)
        ? favoriteNames.filter((name) => name !== connectionName)
        : [...favoriteNames, connectionName],
    );
  };

  const recordHealth = (connectionId: string, health: ConnectionHealth) => {
    setHealthByConnectionId({ ...connectionHealth, [connectionId]: health });
  };

  const table = useDataTable({
    enableColumnPinning: false,
    data: visibleConnections,
    columns: [
      {
        accessorKey: "name",
        header: "Name",
        cell: (ctx) => (
          <Tooltip
            content={`${ctx.row.original.name} · ${redactConnectionUrl(ctx.row.original.url)}`}
            portalled
          >
            <span className="inline-flex flex-col items-start">
              <Link
                to="/connections/$connectionName"
                params={{ connectionName: ctx.row.original.name }}
                className="block truncate font-medium"
              >
                {ctx.row.original.name}
              </Link>
              {isReadOnlyConnection(ctx.row.original.url) ? (
                <Badge
                  colorPalette="success"
                  variant="outline"
                  size="2xs"
                  className="mt-1"
                  data-testid={`connection-safety-${ctx.row.original.name}`}
                >
                  <ShieldCheck className="mr-1 size-3" />
                  Read-only
                </Badge>
              ) : (
                <Badge
                  colorPalette="warning"
                  variant="outline"
                  size="2xs"
                  className="mt-1"
                  data-testid={`connection-safety-${ctx.row.original.name}`}
                >
                  <LucidePenLine className="mr-1 size-3" />
                  Writes enabled
                </Badge>
              )}
            </span>
          </Tooltip>
        ),
      },
      {
        id: "_connect",
        header: "Access",
        size: 180,
        cell: (ctx) => (
          <ConnectionActions
            connection={ctx.row.original}
            onOpen={recordOpened}
            health={connectionHealth[ctx.row.original.id]}
            onHealthChange={recordHealth}
          />
        ),
      },
      {
        id: "_health",
        header: "Health",
        size: 135,
        cell: (ctx) => {
          const health = connectionHealth[ctx.row.original.id];
          const checkedAt = health ? new Date(health.checkedAt).toLocaleString() : undefined;
          const isHealthy = health?.status === "success";

          return (
            <Tooltip
              content={checkedAt ? `Last tested ${checkedAt}` : "Test this connection to check it"}
              portalled
            >
              <span
                className="text-muted-foreground inline-flex items-center gap-1.5 text-xs"
                data-testid={`connection-health-${ctx.row.original.name}`}
              >
                <span
                  aria-hidden="true"
                  className={`size-2 rounded-full ${isHealthy ? "bg-chart-2" : health ? "bg-chart-1" : "bg-muted-foreground/40"}`}
                />
                {isHealthy ? "Healthy" : health ? "Failed" : "Not tested"}
              </span>
            </Tooltip>
          );
        },
      },
      {
        accessorKey: "dialect",
        header: "Dialect",
        cell: (ctx) => {
          const meta = DIALECT_META[ctx.row.original.dialect];
          return (
            <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
              <meta.Icon className="size-3.5" aria-hidden="true" />
              {meta.label}
            </span>
          );
        },
      },
      // {
      // 	accessorKey: "created_at",
      // 	header: "Created At",
      // 	accessorFn: (params) =>
      // 		params.created_at
      // 			? DateTime.format(DateTime.unsafeMake(params.created_at), {
      // 					locale: "fr",
      // 				})
      // 			: "--",
      // },
      // {
      // 	accessorKey: "updated_at",
      // 	header: "Updated At",
      // 	accessorFn: (params) =>
      // 		params.created_at
      // 			? DateTime.format(DateTime.unsafeMake(params.created_at), {
      // 					locale: "fr",
      // 				})
      // 			: "--",
      // },
      {
        accessorKey: "url",
        header: "Endpoint",
        size: 220,
        cell: (ctx) => {
          // H17: local paths show basename + ellipsized parent — never the raw path.
          const pathParts = getEndpointPathParts(ctx.row.original.url);
          return (
            <div className="flex min-w-0 items-center gap-1">
              {pathParts ? (
                <Tooltip
                  content={decodeURIComponent(new URL(ctx.row.original.url).pathname)}
                  portalled
                >
                  <span
                    className="flex min-w-0 flex-col leading-tight"
                    data-testid={`connection-endpoint-${ctx.row.original.name}`}
                  >
                    <span className="text-foreground truncate text-xs font-medium">
                      {pathParts.basename}
                    </span>
                    <span className="text-muted-foreground truncate text-[10px]">
                      {pathParts.parent}
                    </span>
                  </span>
                </Tooltip>
              ) : (
                <span className="text-muted-foreground truncate text-xs">
                  {getEndpointLabel(ctx.row.original.url)}
                </span>
              )}
              <Clipboard.Root value={redactConnectionUrl(ctx.row.original.url)}>
                <Tooltip content="Copy redacted connection URL">
                  <Clipboard.Trigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Copy redacted connection URL">
                      <Clipboard.Indicator copied={<CheckIcon />}>
                        <ClipboardIcon />
                      </Clipboard.Indicator>
                    </Button>
                  </Clipboard.Trigger>
                </Tooltip>
              </Clipboard.Root>
            </div>
          );
        },
      },
      {
        accessorKey: "actions",
        header: "Actions",
        size: 80,
        cell: (ctx) => (
          <ConnectionRowMenu
            connection={ctx.row.original}
            onEdit={setEditingConnection}
            isFavorite={favoriteNames.includes(ctx.row.original.name)}
            onToggleFavorite={toggleFavorite}
          />
        ),
      },
    ],
  });

  // TanStack Table keeps its own option snapshot. Sync the derived search result so
  // the connection finder updates immediately instead of only updating the textbox.
  useEffect(() => {
    table.setOptions((previous) => ({ ...previous, data: visibleConnections }));
  }, [table, visibleConnections]);

  return (
    <div className="bg-background relative min-h-screen px-4 py-6 sm:px-6 sm:py-10 lg:px-10">
      <div className="mx-auto max-w-7xl">
        {/* Header Section */}
        <div className="mb-8 flex items-end justify-between gap-6 sm:mb-10">
          <div className="space-y-2">
            <p className="text-primary text-xs font-semibold tracking-[0.18em] uppercase">
              Dadabase workspace
            </p>
            <h1 className="text-foreground text-3xl font-semibold tracking-tight sm:text-4xl">
              Database Connections
            </h1>
            <p className="text-muted-foreground text-base sm:text-lg">
              Open a saved database or set up a new, safe connection.
            </p>
          </div>
          <div className="flex items-end gap-3">
            <Button data-testid="new-connection-cta" onClick={() => setCreateDialogOpen(true)}>
              <LucidePlus className="size-4" />
              New connection
            </Button>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid items-start gap-8 lg:gap-10">
          <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-foreground text-2xl font-semibold">Saved connections</h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  {savedDatabaseList.data.length} connection
                  {savedDatabaseList.data.length !== 1 ? "s" : ""} found
                </p>
              </div>
              {savedDatabaseList.data.length > 0 ? (
                <div className="relative w-full sm:w-72 sm:shrink-0">
                  <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                  <Input
                    value={connectionSearch}
                    onChange={(event) => setConnectionSearch(event.currentTarget.value)}
                    aria-label="Search saved connections"
                    placeholder="Search connections"
                    className="pl-9"
                  />
                </div>
              ) : null}
            </div>
            {visibleConnections.length ? (
              <div className="bg-card w-full rounded-xl border shadow-sm">
                <div className="divide-border divide-y md:hidden">
                  {visibleConnections.map((connection) => {
                    const health = connectionHealth[connection.id];
                    const endpoint = getEndpointLabel(connection.url);
                    return (
                      <article key={connection.name} className="space-y-3 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <Link
                              to="/connections/$connectionName"
                              params={{ connectionName: connection.name }}
                              className="text-foreground block truncate font-medium hover:underline"
                            >
                              {connection.name}
                            </Link>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              <Badge colorPalette="muted" variant="outline" size="2xs">
                                {connection.dialect}
                              </Badge>
                              {isReadOnlyConnection(connection.url) ? (
                                <Badge colorPalette="success" variant="subtle" size="2xs">
                                  Read-only
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                          <ConnectionRowMenu
                            connection={connection}
                            onEdit={setEditingConnection}
                            isFavorite={favoriteNames.includes(connection.name)}
                            onToggleFavorite={toggleFavorite}
                          />
                        </div>
                        <div className="text-muted-foreground flex items-center gap-2 text-xs">
                          <LucideFileText className="size-3.5 shrink-0" />
                          <span className="truncate" title={endpoint}>
                            {endpoint}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground text-xs">
                            {health?.status === "success"
                              ? "Last check passed"
                              : health?.status === "failure"
                                ? "Last check failed"
                                : "Not checked yet"}
                          </span>
                          <ConnectionActions
                            connection={connection}
                            onOpen={recordOpened}
                            health={health}
                            onHealthChange={recordHealth}
                          />
                        </div>
                      </article>
                    );
                  })}
                </div>
                <div className="hidden overflow-x-auto md:block">
                  <div className="min-w-[700px]">
                    <DataTable
                      key={normalizedSearch}
                      table={table}
                      size="comfortable"
                      resizable={false}
                    />
                  </div>
                </div>
              </div>
            ) : savedDatabaseList.data.length ? (
              <div className="bg-card rounded-xl border border-dashed px-6 py-12 text-center">
                <p className="text-foreground font-medium">No matching connections</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  Search by connection name, database type, or endpoint.
                </p>
                <Button
                  variant="link"
                  className="mt-2 h-auto p-0"
                  onClick={() => setConnectionSearch("")}
                >
                  Clear search
                </Button>
              </div>
            ) : (
              <div className="bg-card rounded-xl border border-dashed px-6 py-12">
                <p className="text-foreground font-medium">No connections yet</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  Start with a local SQLite file or a read-only database connection.
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  data-testid="new-connection-empty-cta"
                  onClick={() => setCreateDialogOpen(true)}
                >
                  <LucidePlus className="size-4" />
                  New connection
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Audit G9: utility toggle rendered last in the DOM (so keyboard tab
          order reaches primary content first) but visually pinned to the
          header corner via absolute positioning. */}
      <DarkModeToggle
        aria-label="Toggle application theme"
        className="absolute top-6 right-4 sm:top-10 sm:right-6 lg:top-10 lg:right-10"
      />

      {/* Create Connection Dialog (H1: form collapsed behind a CTA, not a permanent pane) */}
      <Dialog open={createDialogOpen} onOpenChange={(details) => setCreateDialogOpen(details.open)}>
        <Portal>
          <DialogContent className="max-h-[85vh] w-full max-w-xl overflow-y-auto sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>New connection</DialogTitle>
              <DialogDescription>
                Read-only is on by default. Turn it off only when you intend to make changes.
              </DialogDescription>
            </DialogHeader>
            <ConnectionForm
              mode="create"
              onSuccess={() => {
                // Stay on home so the saved row is visible in the table.
                setCreateDialogOpen(false);
              }}
            />
          </DialogContent>
        </Portal>
      </Dialog>

      {/* Edit Connection Drawer */}
      {editingConnection && (
        <Sheet
          open={!!editingConnection}
          onOpenChange={(details) => {
            if (!details.open) setEditingConnection(null);
          }}
        >
          <SheetContent className="z-50 w-full sm:max-w-[540px]">
            <SheetHeader>
              <SheetTitle>Edit Connection</SheetTitle>
              <SheetDescription>Update the connection details</SheetDescription>
            </SheetHeader>
            <div className="px-4">
              <ConnectionForm
                mode="edit"
                initialValues={{
                  id: editingConnection.id,
                  connectionName: editingConnection.name,
                  connectionType: editingConnection.dialect,
                  preset: null,
                  filePath: "",
                  connectionUrl: editingConnection.url,
                  libsqlAuthToken: "",
                  host: "",
                  port: 5432,
                  databaseName: "",
                  user: "",
                  password: "",
                  readOnly: false,
                  sslMode: null,
                  sshHost: "",
                  sshPort: 22,
                  sshUser: "",
                  sshPrivateKeyPath: "",
                  sshPassword: "",
                }}
                onSuccess={() => {
                  setEditingConnection(null);
                }}
              />
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
};
