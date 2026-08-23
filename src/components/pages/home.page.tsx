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
  LucideWifi,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { DatabaseDialect } from "#src/db/dialect.ts";

import { isReadOnlyConnection } from "#src/lib/connection-security.ts";
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

function ConnectionActions({ connection }: { connection: EditableConnection }) {
  const testConnection = useServerFn(tryConnectionServerFn);
  const [state, setState] = useState<"idle" | "success" | "failure">("idle");

  const testConnectionUrl = async () => {
    const result = await testConnection({
      data: { url: connection.url, dialect: connection.dialect },
    });

    if (result.success) {
      setState("success");
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
      <Link to="/connections/$connectionName" params={{ connectionName: connection.name }}>
        <Button size="sm">Open</Button>
      </Link>
    </HStack>
  );
}

function ConnectionRowMenu({
  connection,
  onEdit,
}: {
  connection: EditableConnection;
  onEdit: (connection: EditableConnection) => void;
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
          <MenuItem value="edit" onClick={() => onEdit(connection)}>
            Edit connection
          </MenuItem>
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

export const HomePage = () => {
  const [editingConnection, setEditingConnection] = useState<EditableConnection | null>(null);
  const [connectionSearch, setConnectionSearch] = useState("");

  const savedDatabaseList = useSuspenseQuery(listDbConnectionQueryOptions);
  const normalizedSearch = connectionSearch.trim().toLocaleLowerCase();
  const visibleConnections = useMemo(
    () =>
      savedDatabaseList.data.filter((connection) => {
        if (!normalizedSearch) return true;
        return [connection.name, connection.dialect, getEndpointLabel(connection.url)]
          .join(" ")
          .toLocaleLowerCase()
          .includes(normalizedSearch);
      }),
    [normalizedSearch, savedDatabaseList.data],
  );

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
                  Writes enabled
                </Badge>
              )}
            </span>
          </Tooltip>
        ),
      },
      {
        id: "_connect",
        size: 180,
        cell: (ctx) => <ConnectionActions connection={ctx.row.original} />,
      },
      { accessorKey: "dialect", header: "Dialect" },
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
        cell: (ctx) => (
          <div className="flex min-w-0 items-center gap-1">
            <span className="text-muted-foreground truncate text-xs">
              {getEndpointLabel(ctx.row.original.url)}
            </span>
            <Clipboard.Root value={ctx.row.original.url}>
              <Tooltip content="Copy connection URL (includes credentials)">
                <Clipboard.Trigger asChild>
                  <Button variant="ghost" size="icon">
                    <Clipboard.Indicator copied={<CheckIcon />}>
                      <ClipboardIcon />
                    </Clipboard.Indicator>
                  </Button>
                </Clipboard.Trigger>
              </Tooltip>
            </Clipboard.Root>
          </div>
        ),
      },
      {
        accessorKey: "actions",
        header: "Actions",
        size: 80,
        cell: (ctx) => (
          <ConnectionRowMenu connection={ctx.row.original} onEdit={setEditingConnection} />
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
    <div className="bg-background min-h-screen px-6 py-10 lg:px-10">
      <div className="mx-auto max-w-7xl">
        {/* Header Section */}
        <div className="mb-10 flex items-end justify-between gap-6">
          <div className="space-y-2">
            <p className="text-primary text-xs font-semibold tracking-[0.18em] uppercase">
              Dadabase workspace
            </p>
            <h1 className="text-foreground text-4xl font-semibold tracking-tight">
              Database Connections
            </h1>
            <p className="text-muted-foreground text-lg">
              Open a saved database or set up a new, safe connection.
            </p>
          </div>
          <DarkModeToggle aria-label="Toggle application theme" />
        </div>

        {/* Main Content Grid */}
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="space-y-4">
            <div className="flex items-end justify-between gap-6">
              <div>
                <h2 className="text-foreground text-2xl font-semibold">Saved connections</h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  {savedDatabaseList.data.length} connection
                  {savedDatabaseList.data.length !== 1 ? "s" : ""} found
                </p>
              </div>
              {savedDatabaseList.data.length > 0 ? (
                <div className="relative w-72 shrink-0">
                  <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                  <Input
                    value={connectionSearch}
                    onInput={(event) => setConnectionSearch(event.currentTarget.value)}
                    aria-label="Search saved connections"
                    placeholder="Search connections"
                    className="pl-9"
                  />
                </div>
              ) : null}
            </div>
            {visibleConnections.length ? (
              <div className="bg-card w-full overflow-hidden rounded-xl border shadow-sm">
                <div className="min-w-[700px]">
                  <DataTable
                    key={normalizedSearch}
                    table={table}
                    size="comfortable"
                    resizable={false}
                  />
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
              </div>
            )}
          </div>

          <aside>
            <div className="sticky top-8">
              <div className="bg-card overflow-hidden rounded-xl border shadow-sm">
                <div className="border-b px-5 py-5">
                  <p className="text-primary text-xs font-semibold tracking-[0.16em] uppercase">
                    New connection
                  </p>
                  <h2 className="text-foreground mt-1 text-lg font-semibold">Connect safely</h2>
                  <p className="text-muted-foreground mt-1 text-sm leading-5">
                    Read-only is on by default. Turn it off only when you intend to make changes.
                  </p>
                </div>
                <div className="p-5">
                  <ConnectionForm mode="create" />
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

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
