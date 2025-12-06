import {
	Accordion,
	AccordionItem,
	AccordionItemContent,
	AccordionItemTrigger,
} from "#src/components/ui/accordion";
import { createDbConnectionMutation } from "#src/server/db-connection/start-fns/create-db-connection.start.ts";
import { updateDbConnectionMutation } from "#src/server/db-connection/start-fns/update-db-connection.start.ts";
import { tryConnectionServerFn } from "#src/server/introspection/start-fns/try-connection.start.ts";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import z from "zod";
import { useAppForm } from "../form/form.hook.ts";
import { HStack, Stack } from "../ui/layout.tsx";
import { toaster } from "../ui/toaster.tsx";
import { Button } from "../ui/button.tsx";
import { LucideCheck, LucideCross } from "lucide-react";
import { DatabaseDialect } from "#src/db/dialect.ts";

const connectionType = z.enum(DatabaseDialect);
const connectionFormSchema = z
	.object({
		connectionName: z.string().min(1),
		connectionType,
		// sqlite / libsql
		filePath: z.string(),
		libsqlAuthToken: z.string(),
		// postgres / mysql
		connectionUrl: z.string(),
		host: z.string(),
		port: z.number(),
		databaseName: z.string(),
		user: z.string(),
		password: z.string(),
	})
	.refine(
		(data) => {
			// SQLite requires filePath
			if (data.connectionType === DatabaseDialect.SQLite) {
				return data.filePath.length > 0;
			}
			// LibSQL requires connectionUrl
			if (data.connectionType === DatabaseDialect.LibSQL) {
				return data.connectionUrl.length > 0;
			}
			// Postgres requires connectionUrl to be valid
			if (data.connectionType === DatabaseDialect.Postgres) {
				try {
					new URL(data.connectionUrl);
					return true;
				} catch {
					return false;
				}
			}
			return true;
		},
		{
			message: "Invalid connection configuration for selected type",
			path: ["connectionUrl"],
		},
	);

const defaultValues = {
	connectionName: "New connection",
	connectionType: DatabaseDialect.Postgres as z.infer<typeof connectionType>,
	filePath: "",
	libsqlAuthToken: "",
	connectionUrl: "postgres://localhost:5432/dadabase",
	host: "localhost",
	port: 5432,
	databaseName: "dadabase",
	user: "user",
	password: "password",
};

export type ConnectionFormValues = z.infer<typeof connectionFormSchema>;

interface ConnectionFormProps {
	mode?: "create" | "edit";
	initialValues?: ConnectionFormValues & { id?: string };
	onSuccess?: (connectionName?: string) => void;
}

export function ConnectionForm({
	mode = "create",
	initialValues,
	onSuccess,
}: ConnectionFormProps) {
	const createMutation = useMutation(createDbConnectionMutation);
	const updateMutation = useMutation(updateDbConnectionMutation);
	const testConnectionFn = useServerFn(tryConnectionServerFn);
	const [testState, setTestState] = useState<
		"idle" | "loading" | "success" | "error"
	>("idle");

	const form = useAppForm({
		defaultValues: getInitialValues(),
		validators: {
			onChange: connectionFormSchema,
		},
		onSubmitInvalid(props) {
			console.log(props.formApi.getAllErrors(), props.value);
			toaster.create({ title: "Invalid form" });
		},
		onSubmit: async (ctx) => {
			const isCreate = mode === "create";
			const connectionType = ctx.value.connectionType;

			// Build the connection URL based on type
			let connectionUrl = ctx.value.connectionUrl;
			if (connectionType === DatabaseDialect.SQLite) {
				connectionUrl = `sqlite://${ctx.value.filePath}`;
			} else if (connectionType === DatabaseDialect.LibSQL) {
				if (ctx.value.libsqlAuthToken) {
					connectionUrl = `${ctx.value.connectionUrl}?authToken=${ctx.value.libsqlAuthToken}`;
				} else {
					connectionUrl = ctx.value.connectionUrl;
				}
			}

			try {
				if (isCreate) {
					await createMutation.mutateAsync({
						data: {
							name: ctx.value.connectionName,
							url: connectionUrl,
							dialect: connectionType,
						},
					});

					toaster.create({
						title: (
							<HStack align="center" className="text-chart-2">
								<LucideCheck className="h-3 w-3" />
								Success
							</HStack>
						),
						description: "Connection created successfully",
					});
					onSuccess?.(ctx.value.connectionName);
				} else {
					await updateMutation.mutateAsync({
						data: {
							id: initialValues?.id || "",
							name: ctx.value.connectionName,
							url: connectionUrl,
						},
					});
					toaster.create({
						title: (
							<HStack align="center" className="text-chart-2">
								<LucideCheck className="h-3 w-3" />
								Success
							</HStack>
						),
						description: "Connection updated successfully",
					});
					onSuccess?.();
				}
			} catch (error) {
				toaster.create({
					title: (
						<HStack align="center" className="text-chart-1">
							<LucideCross className="h-3 w-3" />
							Error
						</HStack>
					),
					description: "Failed to save connection",
				});
			}
		},
	});

	function getInitialValues() {
		if (mode === "create") {
			return defaultValues;
		}

		const values = { ...defaultValues, ...initialValues };
		if (initialValues?.connectionUrl) {
			const parsed = parseConnectionUrl(initialValues.connectionUrl);
			values.connectionType =
				initialValues.connectionType ||
				(parsed.protocol as z.infer<typeof connectionType>);
			values.user = parsed.user;
			values.password = parsed.password;
			values.host = parsed.host;
			values.port = parsed.port;
			values.databaseName = parsed.databaseName;
		} else {
			values.connectionUrl = getConnectionUrl(values);
		}

		return values;
	}

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

	function parseConnectionUrl(connectionUrl: string) {
		const url = new URL(connectionUrl);
		const protocol = url.protocol.replace(":", ""); // "postgres:" -> "postgres"
		const user = url.username;
		const password = url.password;
		const host = url.hostname;
		const port = url.port ? parseInt(url.port, 10) : 5432; // Default to 5432 if no port specified
		const databaseName = url.pathname.replace("/", "");

		return {
			protocol,
			user,
			password,
			host,
			port,
			databaseName,
		};
	}

	function updateFieldsFromConnectionUrl(connectionUrl: string) {
		try {
			const parsed = parseConnectionUrl(connectionUrl);

			form.setFieldValue(
				"connectionType",
				parsed.protocol as z.infer<typeof connectionType>,
			);
			form.setFieldValue("user", parsed.user);
			form.setFieldValue("password", parsed.password);
			form.setFieldValue("host", parsed.host);
			form.setFieldValue("port", parsed.port);
			form.setFieldValue("databaseName", parsed.databaseName);
		} catch (e) {
			console.error("Invalid connection URL:", e);
		}
	}

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
			className={`space-y-4`}
		>
			<form.AppField name="connectionType">
				{(field) => (
					<field.Select
						label="Type"
						defaultValue={[field.state.value]}
						options={[
							{ label: "Postgres", value: "postgres" },
							{ label: "SQLite", value: "sqlite" },
							{ label: "libSQL / Turso", value: "libsql" },
							// { label: "MySQL", value: "mysql" },
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

					if (connectionType === DatabaseDialect.SQLite) {
						return (
							<>
								<form.AppField name="connectionName">
									{(field) => <field.TextField label="Name" />}
								</form.AppField>
								<form.AppField name="filePath">
									{(field) => (
										<field.TextField
											label="File Path"
											placeholder="/path/to/database.db"
										/>
									)}
								</form.AppField>
							</>
						);
					}

					if (connectionType === DatabaseDialect.LibSQL) {
						return (
							<>
								<form.AppField name="connectionName">
									{(field) => <field.TextField label="Name" />}
								</form.AppField>
								<form.AppField name="connectionUrl">
									{(field) => (
										<field.TextField
											label="URL"
											placeholder="libsql://your-database.turso.io"
										/>
									)}
								</form.AppField>
								<form.AppField name="libsqlAuthToken">
									{(field) => (
										<field.TextField
											label="Auth Token (optional)"
											placeholder="your-auth-token"
										/>
									)}
								</form.AppField>
							</>
						);
					}

					return (
						<Stack>
							<form.AppField name="connectionName">
								{(field) => <field.TextField label="Name" />}
							</form.AppField>

							<Stack gap="2">
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
											label="URL"
											placeholder="postgres://user:pass@host:5432/db"
										/>
									)}
								</form.AppField>
								<span className="text-xs text-muted-foreground">
									Or fill in the fields below
								</span>
							</Stack>

							<Accordion
								collapsible
								className="border rounded-md overflow-hidden"
							>
								<AccordionItem value="or-fields" className="w-full">
									<AccordionItemTrigger className="px-3 py-2 hover:bg-muted/50 transition-colors text-sm">
										<span className="font-medium">
											Host / Port / Database / User / Password
										</span>
									</AccordionItemTrigger>
									<AccordionItemContent className="px-3 py-3 border-t space-y-3 bg-muted/30">
										<div className="grid grid-cols-2 gap-2 w-full">
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
												{(field) => (
													<field.TextField type="number" label="Port" />
												)}
											</form.AppField>
											<div className="col-span-2">
												<form.AppField
													name="databaseName"
													listeners={{ onChange: updateConnectionUrl }}
												>
													{(field) => <field.TextField label="Database" />}
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
												{(field) => (
													<field.TextField type="text" label="Password" />
												)}
											</form.AppField>
										</div>
									</AccordionItemContent>
								</AccordionItem>
							</Accordion>
						</Stack>
					);
				}}
			/>

			<div className="flex justify-between gap-2 pt-4">
				<Button
					type="button"
					variant="outline"
					disabled={testState === "loading"}
					onClick={async () => {
						const connectionUrl = form.getFieldValue("connectionUrl");
						const connectionType = form.getFieldValue("connectionType");

						if (!connectionUrl) {
							toaster.create({ title: "Connection URL is required" });
							return;
						}

						try {
							setTestState("loading");
							const result = await testConnectionFn({
								data: {
									url: connectionUrl,
									dialect: connectionType,
								},
							});

							if (result.success) {
								setTestState("success");
								toaster.create({
									title: (
										<HStack align="center" className="text-chart-2">
											<LucideCheck className="h-3 w-3" />
											Connection successful
										</HStack>
									),
								});
								setTimeout(() => setTestState("idle"), 2000);
							} else {
								setTestState("error");
								toaster.create({
									title: (
										<HStack align="center" className="text-chart-1">
											<LucideCross className="h-3 w-3" />
											Connection failed
										</HStack>
									),
									description: result.message,
								});
								setTimeout(() => setTestState("idle"), 2000);
							}
						} catch (error) {
							setTestState("error");
							toaster.create({
								title: (
									<HStack align="center" className="text-chart-1">
										<LucideCross className="h-3 w-3" />
										Error
									</HStack>
								),
								description: "Failed to test connection",
							});
							setTimeout(() => setTestState("idle"), 2000);
						}
					}}
				>
					Test Connection
				</Button>
				<form.AppForm>
					<form.SubscribeButton label={mode === "create" ? "Add" : "Update"} />
				</form.AppForm>
			</div>
		</form>
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
