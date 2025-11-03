import { deleteDbConnectionServerFn } from "#src/server-fns/pg/delete-db-connection.server.ts";
import { getSavedConnectionsQueryOptions } from "#src/server-fns/pg/get-saved-connections.server.ts";
import { testPgConnectionServerFn } from "#src/server-fns/pg/test-pg-connection.server.ts";
import { Clipboard } from "@ark-ui/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { DateTime } from "effect";
import { CheckIcon, ClipboardCopyIcon, EllipsisIcon } from "lucide-react";
import { useState } from "react";
import { DataTable } from "../data-table.tsx";
import { Button } from "../ui/button.tsx";
import { toaster } from "../ui/toaster.tsx";
import { useDataTable } from "../use-data-table.ts";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "../ui/menu.tsx";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "../ui/sheet.tsx";
import { ConnectionForm } from "./connection.form.tsx";
import { AlertDialog } from "../ui/alert-dialog.tsx";
import { queryClient } from "#src/integrations/tanstack-query/query-client.ts";

export const HomePage = () => {
	const [editingConnection, setEditingConnection] = useState<{
		id: string;
		name: string;
		url: string;
		dialect: string;
		created_at: number;
		updated_at: number;
	} | null>(null);
	const savedDatabaseList = useSuspenseQuery(getSavedConnectionsQueryOptions);
	const table = useDataTable({
		data: savedDatabaseList.data,
		columns: [
			{
				accessorKey: "connect",
				header: "Connect",
				cell: (ctx) => {
					const testPgConnectionUrl = useServerFn(testPgConnectionServerFn);
					return (
						<Button
							variant="outline"
							size="sm"
							onClick={async () => {
								const canConnect = await testPgConnectionUrl({
									data: { url: ctx.row.original.url },
								});
								if (canConnect.success) {
									toaster.create({
										title: "Connection successful",
										description: "You can now connect to this database",
									});
								} else {
									toaster.create({
										title: "Connection failed",
										description: canConnect.message,
									});
								}
							}}
						>
							⚡ Test connection
						</Button>
					);
				},
			},
			{ accessorKey: "name", header: "Name" },
			{ accessorKey: "dialect", header: "Dialect" },
			{
				accessorKey: "created_at",
				header: "Created At",
				accessorFn: (params) =>
					params.created_at
						? DateTime.format(DateTime.unsafeMake(params.created_at), {
								locale: "fr",
							})
						: "--",
			},
			{
				accessorKey: "updated_at",
				header: "Updated At",
				accessorFn: (params) =>
					params.created_at
						? DateTime.format(DateTime.unsafeMake(params.created_at), {
								locale: "fr",
							})
						: "--",
			},
			{
				accessorKey: "url",
				header: "URL",
				cell: (ctx) => (
					<Clipboard.Root value={ctx.row.original.url}>
						<Clipboard.Trigger asChild>
							<Button variant="ghost" size="icon">
								<Clipboard.Indicator copied={<CheckIcon />}>
									<ClipboardCopyIcon />
								</Clipboard.Indicator>
							</Button>
						</Clipboard.Trigger>
					</Clipboard.Root>
				),
			},
			{
				accessorKey: "actions",
				header: "Actions",
				cell: (ctx) => {
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
							<MenuContent>
								<MenuItem
									value="edit"
									onClick={() => setEditingConnection(ctx.row.original)}
								>
									Edit
								</MenuItem>
								<AlertDialog
									trigger={<MenuItem value="delete">Delete</MenuItem>}
									title="Delete connection?"
									description="Are you sure you want to delete this connection?"
									onConfirm={() => {
										deleteDbConnectionServerFn({
											data: { id: ctx.row.original.id },
										});
										queryClient.invalidateQueries();
									}}
								/>
							</MenuContent>
						</Menu>
					);
				},
			},
		],
	});

	return (
		<div className="min-h-screen bg-background py-8 px-4 sm:px-6 lg:px-8">
			<div className="max-w-6xl mx-auto">
				{/* Header Section */}
				<div className="space-y-2 mb-8">
					<h1 className="text-4xl font-bold tracking-tight text-foreground">
						Database Connections
					</h1>
					<p className="text-lg text-muted-foreground">
						Manage and test your database connections in one place
					</p>
				</div>

				{/* Main Content Grid */}
				<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
					{/* Saved Connections - Takes 2/3 on larger screens */}
					<div className="lg:col-span-2 space-y-4">
						<div className="flex items-center justify-between">
							<div>
								<h2 className="text-2xl font-semibold text-foreground">
									Saved Connections
								</h2>
								<p className="text-sm text-muted-foreground mt-1">
									{savedDatabaseList.data.length} connection
									{savedDatabaseList.data.length !== 1 ? "s" : ""} found
								</p>
							</div>
						</div>
						<div className="rounded-lg border bg-card shadow-sm overflow-hidden">
							<DataTable table={table} />
						</div>
					</div>

					{/* Add New Connection - Takes 1/3 on larger screens */}
					<div className="lg:col-span-1">
						<div className="sticky top-8">
							<div className="rounded-lg border bg-card shadow-md overflow-hidden">
								{/* Header */}
								<div className="bg-linear-to-r from-primary/5 to-accent/5 px-4 py-4 border-b">
									<h2 className="text-sm font-semibold text-foreground">
										Add Connection
									</h2>
									<p className="text-xs text-muted-foreground mt-1">
										Create a new connection
									</p>
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
									connectionType: "postgres",
									filePath: "",
									connectionUrl: editingConnection.url,
									host: "",
									port: 5432,
									databaseName: "",
									user: "",
									password: "",
								}}
								onSuccess={() => {
									setEditingConnection(null);
									queryClient.invalidateQueries();
								}}
							/>
						</div>
					</SheetContent>
				</Sheet>
			)}
		</div>
	);
};
