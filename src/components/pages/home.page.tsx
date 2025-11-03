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
import { Button } from "../ui/button.tsx";
import { stack, Stack } from "../ui/layout.tsx";
import { toaster } from "../ui/toaster.tsx";
import { useDataTable } from "../use-data-table.ts";

const connectionType = z.enum(["postgres", "mysql", "sqlite"]);
const schema = z.object({
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
						<button
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
							⚡ Test
						</button>
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
						<Button
							variant="secondary"
							onClick={() =>
								deleteDbConnectionServerFn({
									data: { id: ctx.row.original.id },
								})
							}
						>
							<TrashIcon />
						</Button>
					);
				},
			},
		],
	});

	return (
		<Stack>
			<DataTable table={table} />
			<SimpleForm />
		</Stack>
	);
};

function SimpleForm() {
	// const saveDbConnection = useServerFn(saveDbConnectionServerFn);

	const form = useAppForm({
		defaultValues: {
			connectionType: "" as z.infer<typeof connectionType>,
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
				data: { name: "New connection", url: ctx.value.connectionUrl },
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
		<Stack justify="center">
			<div className="w-full max-w-2xl p-8">
				<form
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						form.handleSubmit();
					}}
					className={stack()}
				>
					<form.AppField name="connectionType">
						{(field) => (
							<field.Select
								label="Connection Type"
								defaultValue={[field.state.value]}
								options={[
									{ label: "Postgres", value: "postgres" },
									{ label: "MySQL", value: "mysql" },
									{ label: "SQLite", value: "sqlite" },
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
								<div className="grid grid-cols-2 gap-4">
									<div className="col-span-2">
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
											{(field) => <field.TextField label="Connection URL" />}
										</form.AppField>
									</div>
									<hr className="col-span-2" />
									<div className="col-span-2">Or</div>
									<form.AppField
										name="host"
										listeners={{ onChange: updateConnectionUrl }}
									>
										{(field) => <field.TextField label="Host" />}
									</form.AppField>
									<form.AppField
										name="port"
										listeners={{ onChange: updateConnectionUrl }}
									>
										{(field) => <field.TextField type="number" label="Port" />}
									</form.AppField>
									<div className="col-span-2">
										<form.AppField
											name="databaseName"
											listeners={{ onChange: updateConnectionUrl }}
										>
											{(field) => <field.TextField label="Database name" />}
										</form.AppField>
									</div>
									<form.AppField
										name="user"
										listeners={{ onChange: updateConnectionUrl }}
									>
										{(field) => <field.TextField label="User" />}
									</form.AppField>
									<form.AppField
										name="password"
										listeners={{ onChange: updateConnectionUrl }}
									>
										{(field) => <field.TextField label="Password" />}
									</form.AppField>
								</div>
							);
						}}
					/>

					<div className="flex justify-end">
						<form.AppForm>
							<form.SubscribeButton label="Submit" />
						</form.AppForm>
					</div>
				</form>
			</div>
		</Stack>
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
