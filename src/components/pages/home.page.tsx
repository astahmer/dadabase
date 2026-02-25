import type { DatabaseDialect } from "#src/db/dialect.ts";

import { redactConnectionUrl } from "#src/lib/redact-connection-url.ts";
import { deleteDbConnectionMutation } from "#src/server/db-connection/start-fns/delete-db-connection.start.ts";
import { listDbConnectionQueryOptions } from "#src/server/db-connection/start-fns/list-db-connection.start.ts";
import { tryConnectionServerFn } from "#src/server/introspection/start-fns/try-connection.start.ts";
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
} from "lucide-react";
import { useState } from "react";

import { DataTable } from "../data-table/data-table.tsx";
import { useDataTable } from "../data-table/use-data-table.ts";
import { AlertDialog } from "../ui/alert-dialog.tsx";
import { Button } from "../ui/button.tsx";
import { DarkModeToggle } from "../ui/dark-mode-toggle.tsx";
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

export const HomePage = () => {
  const [editingConnection, setEditingConnection] = useState<EditableConnection | null>(null);

  const savedDatabaseList = useSuspenseQuery(listDbConnectionQueryOptions);
  const table = useDataTable({
    enableColumnPinning: false,
    data: savedDatabaseList.data,
    columns: [
      {
        accessorKey: "name",
        header: "Name",
        cell: (ctx) => (
          <Tooltip content={redactConnectionUrl(ctx.row.original.url)} portalled>
            <Link
              to="/connections/$connectionName"
              params={{ connectionName: ctx.row.original.name }}
            >
              {ctx.row.original.name}
            </Link>
          </Tooltip>
        ),
      },
      {
        id: "_connect",
        size: 280,
        cell: (ctx) => {
          // biome-ignore lint/correctness/useHookAtTopLevel: ok
          const testPgConnectionUrl = useServerFn(tryConnectionServerFn);
          // biome-ignore lint/correctness/useHookAtTopLevel: ok
          const [state, setState] = useState("idle");
          return (
            <HStack>
              <Button
                className="ml-auto"
                variant="outline"
                size="sm"
                onClick={async () => {
                  const canConnect = await testPgConnectionUrl({
                    data: {
                      url: ctx.row.original.url,
                      dialect: ctx.row.original.dialect,
                    },
                  });
                  if (canConnect.success) {
                    setState("success");
                    toaster.create({
                      title: (
                        <HStack align="center" className="text-chart-2">
                          <LucideCheck className="h-3 w-3" />
                          Connection successful
                        </HStack>
                      ),
                      description: "You can now connect to this database",
                    });
                  } else {
                    setState("failure");
                    toaster.create({
                      title: (
                        <HStack align="center" className="text-chart-1">
                          <LucideAlertCircle className="h-3 w-3" />
                          Connection failed
                        </HStack>
                      ),
                      description: canConnect.message,
                    });
                  }
                }}
              >
                {state === "idle" ? (
                  <>
                    <LucideWifi className="h-4 w-4" />
                    Test
                  </>
                ) : state === "success" ? (
                  <>
                    <LucideCheck className="text-chart-2 h-4 w-4" />
                    Success
                  </>
                ) : (
                  <>
                    <LucideAlertCircle className="text-chart-1 h-4 w-4" />
                    Error
                  </>
                )}
              </Button>
              <Link
                to="/connections/$connectionName"
                params={{ connectionName: ctx.row.original.name }}
              >
                <Button size="sm">⚡ Connect</Button>
              </Link>
            </HStack>
          );
        },
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
        header: "URL",
        size: 80,
        cell: (ctx) => (
          <Clipboard.Root value={ctx.row.original.url}>
            <Tooltip content={ctx.row.original.url}>
              <Clipboard.Trigger asChild>
                <Button variant="ghost" size="icon">
                  <Clipboard.Indicator copied={<CheckIcon />}>
                    <ClipboardIcon />
                  </Clipboard.Indicator>
                </Button>
              </Clipboard.Trigger>
            </Tooltip>
          </Clipboard.Root>
        ),
      },
      {
        accessorKey: "actions",
        header: "Actions",
        size: 80,
        cell: (ctx) => {
          // biome-ignore lint/correctness/useHookAtTopLevel: ok
          const deleteMutation = useMutation(deleteDbConnectionMutation);
          return (
            <Menu>
              <MenuTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  className="rounded-full shadow-none"
                  aria-label="Open menu"
                >
                  <EllipsisIcon size={16} aria-hidden="true" />
                </Button>
              </MenuTrigger>
              <Portal>
                <MenuContent>
                  <MenuItem value="edit" onClick={() => setEditingConnection(ctx.row.original)}>
                    Edit
                  </MenuItem>
                  <AlertDialog
                    trigger={<MenuItem value="delete">Delete</MenuItem>}
                    title="Delete connection?"
                    description="Are you sure you want to delete this connection?"
                    onConfirm={() => {
                      deleteMutation.mutateAsync({
                        data: { id: ctx.row.original.id },
                      });
                    }}
                  />
                </MenuContent>
              </Portal>
            </Menu>
          );
        },
      },
    ],
  });

  return (
    <div className="bg-background min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        {/* Header Section */}
        <div className="mb-8 flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-foreground text-4xl font-bold tracking-tight">
              Database Connections
            </h1>
            <p className="text-muted-foreground text-lg">
              Manage and test your database connections in one place
            </p>
          </div>
          <DarkModeToggle />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Saved Connections - Takes 2/3 on larger screens */}
          <div className="space-y-4 lg:col-span-2">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-foreground text-2xl font-semibold">Saved Connections</h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  {savedDatabaseList.data.length} connection
                  {savedDatabaseList.data.length !== 1 ? "s" : ""} found
                </p>
              </div>
            </div>
            <div className="bg-card w-full overflow-hidden rounded-lg border shadow-sm">
              <DataTable table={table} size="comfortable" resizable={false} />
            </div>
          </div>

          {/* Add New Connection - Takes 1/3 on larger screens */}
          <div className="lg:col-span-1">
            <div className="sticky top-8">
              <div className="bg-card overflow-hidden rounded-lg border shadow-md">
                {/* Header */}
                <div className="from-primary/5 to-accent/5 border-b bg-linear-to-r px-4 py-4">
                  <h2 className="text-foreground text-sm font-semibold">Add Connection</h2>
                  <p className="text-muted-foreground mt-1 text-xs">Create a new connection</p>
                </div>
                {/* Form Content */}
                <div className="p-4">
                  <ConnectionForm mode="create" />
                </div>
              </div>
            </div>
          </div>
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
