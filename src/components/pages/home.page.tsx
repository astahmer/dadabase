import { deleteDbConnectionServerFn } from "#src/server-fns/pg/delete-db-connection.server.ts";
import { getSavedConnectionsQueryOptions } from "#src/server-fns/pg/get-saved-connections.server.ts";
import { saveDbConnectionServerFn } from "#src/server-fns/pg/save-db-connection.server.ts";
import { testPgConnectionServerFn } from "#src/server-fns/pg/test-pg-connection.server.ts";
import { Clipboard } from "@ark-ui/react";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { DateTime } from "effect";
import { CheckIcon, ClipboardCopyIcon, TrashIcon } from "lucide-react";
import z from "zod";
import { DataTable } from "../data-table.tsx";
import { useAppForm } from "../form/form.hook.ts";
import { AlertDialog } from "../ui/alert-dialog.tsx";
import { Button } from "../ui/button.tsx";
import { stack } from "../ui/layout.tsx";
import { toaster } from "../ui/toaster.tsx";
import { useDataTable } from "../use-data-table.ts";
import {
	Accordion,
	AccordionItem,
	AccordionItemContent,
	AccordionItemTrigger,
} from "#src/components/ui/accordion";

const connectionType = z.enum(["postgres", "mysql", "sqlite"]);
const schema = z.object({
	connectionName: z.string().min(1),
	connectionType,
	// sqlite
	filePath: z.string(),
	// postgres / mysql
	connectionUrl: z.url(),
	host: z.string(),
	port: z.number(),
	databaseName: z.string(),
	user: z.string(),
	password: z.string(),
});

export const HomePage = () => {
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
						<AlertDialog
							trigger={
								<Button variant="destructive" size="sm">
									<TrashIcon className="size-4" />
								</Button>
							}
							title="Delete connection?"
							description="Are you sure you want to delete this connection?"
							onConfirm={() =>
								deleteDbConnectionServerFn({
									data: { id: ctx.row.original.id },
								})
							}
							onCancel={() => console.log("cancel")}
						/>
					);
				},
			},
		],
	});

	return (
		<div className="min-h-screen bg-background py-12 px-4 sm:px-6 lg:px-8">
			<div className="max-w-7xl mx-auto space-y-12">
				{/* Header Section */}
				<div className="space-y-2">
					<h1 className="text-4xl font-bold tracking-tight text-foreground">
						Database Connections
					</h1>
					<p className="text-lg text-muted-foreground">
						Manage and test your database connections in one place
					</p>
				</div>

				{/* Saved Connections Section */}
				<div className="space-y-4">
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

				{/* Add New Connection Section */}
				<SimpleForm />
			</div>
		</div>
	);
};

function SimpleForm() {
	// const saveDbConnection = useServerFn(saveDbConnectionServerFn);

	const form = useAppForm({
		defaultValues: {
			connectionName: "New connection",
			connectionType: "postgres" as z.infer<typeof connectionType>,
			// sqlite
			filePath: "",
			// postgres / mysql
			connectionUrl: "postgres://localhost:5432/dadabase",
			host: "localhost",
			port: 5432,
			databaseName: "dadabase",
			user: "user",
			password: "password",
		},
		validators: {
			onChange: schema,
		},
		onSubmitInvalid(_props) {
			toaster.create({ title: "Invalid form" });
		},
		onSubmit: async (ctx) => {
			saveDbConnectionServerFn({
				data: { name: ctx.value.connectionName, url: ctx.value.connectionUrl },
			});
		},
	});

	function updateConnectionUrl() {
		const connectionType = form.getFieldValue("connectionType");
		const host = form.getFieldValue("host");
		const port = form.getFieldValue("port");
		const databaseName = form.getFieldValue("databaseName");
		const user = form.getFieldValue("user");
		const password = form.getFieldValue("password");

		const url = getConnectionUrl({
			connectionType,
			host,
			port,
			databaseName,
			user,
			password,
		});

		form.setFieldValue("connectionUrl", url);
	}

	function updateFieldsFromConnectionUrl(connectionUrl: string) {
		try {
			const url = new URL(connectionUrl);
			const protocol = url.protocol.replace(":", ""); // "postgres:" -> "postgres"
			const user = url.username;
			const password = url.password;
			const host = url.hostname;
			const port = parseInt(url.port, 10);
			const databaseName = url.pathname.replace("/", "");

			form.setFieldValue(
				"connectionType",
				protocol as z.infer<typeof connectionType>,
			);
			form.setFieldValue("user", user);
			form.setFieldValue("password", password);
			form.setFieldValue("host", host);
			form.setFieldValue("port", port);
			form.setFieldValue("databaseName", databaseName);
		} catch (e) {
			console.error("Invalid connection URL:", e);
		}
	}

	return (
		<div className="space-y-4">
			<div>
				<h2 className="text-2xl font-semibold text-foreground">
					Add New Connection
				</h2>
				<p className="text-sm text-muted-foreground mt-1">
					Create a new database connection
				</p>
			</div>

			<div className="rounded-lg border bg-card shadow-sm p-6">
				<form
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit();
					}}
					className={`${stack()} space-y-6`}
				>
					<form.AppField name="connectionType">
						{(field) => (
							<field.Select
								label="Connection Type"
								defaultValue={[field.state.value]}
								options={[
									{ label: "Postgres", value: "postgres" },
									// { label: "MySQL", value: "mysql" },
									// { label: "SQLite", value: "sqlite" },
								]}
							/>
						)}
					</form.AppField>

					<form.Subscribe
						selector={(state) => state.values.connectionType}
						children={(connectionType) => {
							if (!connectionType) {
								return;
							}

							if (connectionType === "sqlite") {
								return (
									<>
										<form.AppField name="connectionUrl">
											{(field) => <field.TextField label="Connection URL" />}
										</form.AppField>
									</>
								);
							}

							return (
								<div className="space-y-6">
									<div>
										<form.AppField name="connectionName">
											{(field) => <field.TextField label="Connection Name" />}
										</form.AppField>
									</div>

									<div className="space-y-2">
										<label className="text-sm font-medium text-foreground">
											Connection URL
										</label>
										<form.AppField
											name="connectionUrl"
											listeners={{
												onChange: (props) => {
													if (!props.value.startsWith("postgres://")) {
														form.setFieldValue(
															"connectionUrl",
															`postgres://${props.value}`,
														);
													}
												},
												onBlur: (props) => {
													updateFieldsFromConnectionUrl(props.value);
												},
											}}
										>
											{(field) => (
												<field.TextField
													label=""
													placeholder="postgres://user:password@host:5432/dbname"
												/>
											)}
										</form.AppField>
										<p className="text-xs text-muted-foreground">
											Or fill in the fields below
										</p>
									</div>

									<Accordion collapsible className="border rounded-lg">
										<AccordionItem value="or-fields" className="w-full">
											<AccordionItemTrigger className="px-4 py-3 hover:bg-muted/50 transition-colors">
												<span className="font-medium text-sm">
													Connection Details
												</span>
											</AccordionItemTrigger>
											<AccordionItemContent className="px-4 py-4 border-t">
												<div className="grid grid-cols-2 gap-4 w-full space-y-4">
													<div className="col-span-1">
														<form.AppField
															name="host"
															listeners={{ onChange: updateConnectionUrl }}
														>
															{(field) => <field.TextField label="Host" />}
														</form.AppField>
													</div>
													<div className="col-span-1">
														<form.AppField
															name="port"
															listeners={{ onChange: updateConnectionUrl }}
														>
															{(field) => (
																<field.TextField type="number" label="Port" />
															)}
														</form.AppField>
													</div>
													<div className="col-span-2">
														<form.AppField
															name="databaseName"
															listeners={{ onChange: updateConnectionUrl }}
														>
															{(field) => (
																<field.TextField label="Database Name" />
															)}
														</form.AppField>
													</div>
													<div className="col-span-1">
														<form.AppField
															name="user"
															listeners={{ onChange: updateConnectionUrl }}
														>
															{(field) => <field.TextField label="User" />}
														</form.AppField>
													</div>
													<div className="col-span-1">
														<form.AppField
															name="password"
															listeners={{ onChange: updateConnectionUrl }}
														>
															{(field) => (
																<field.TextField type="text" label="Password" />
															)}
														</form.AppField>
													</div>
												</div>
											</AccordionItemContent>
										</AccordionItem>
									</Accordion>
								</div>
							);
						}}
					/>

					<div className="flex justify-end gap-3 pt-4 border-t">
						<form.AppForm>
							<form.SubscribeButton label="Add Connection" />
						</form.AppForm>
					</div>
				</form>
			</div>
		</div>
	);
}

function getConnectionUrl(props: {
	connectionType: string;
	host: string;
	port: number;
	databaseName: string;
	user: string;
	password: string;
}) {
	const { connectionType, host, port, databaseName, user, password } = props;

	return `${connectionType}://${user}:${password}@${host}:${port}/${databaseName}`;
}
