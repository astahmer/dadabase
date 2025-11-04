import {
	Accordion,
	AccordionItem,
	AccordionItemContent,
	AccordionItemTrigger,
} from "#src/components/ui/accordion";
import { queryClient } from "#src/query-client.ts";
import { createDbConnectionMutation } from "#src/server/start-fns/db-connection/create-db-connection.start.ts";
import { updateDbConnectionMutation } from "#src/server/start-fns/db-connection/update-db-connection.start.ts";
import { useMutation } from "@tanstack/react-query";
import z from "zod";
import { useAppForm } from "../form/form.hook.ts";
import { Stack } from "../ui/layout.tsx";
import { toaster } from "../ui/toaster.tsx";

const connectionType = z.enum(["postgres", "mysql", "sqlite"]);
const connectionFormSchema = z.object({
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

const defaultValues = {
	connectionName: "New connection",
	connectionType: "postgres" as z.infer<typeof connectionType>,
	filePath: "",
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
	onSuccess?: () => void;
}

export function ConnectionForm({
	mode = "create",
	initialValues,
	onSuccess,
}: ConnectionFormProps) {
	const createMutation = useMutation(createDbConnectionMutation);
	const updateMutation = useMutation(updateDbConnectionMutation);

	const form = useAppForm({
		defaultValues: getInitialValues(),
		validators: {
			onChange: connectionFormSchema,
		},
		onSubmitInvalid(_props) {
			toaster.create({ title: "Invalid form" });
		},
		onSubmit: async (ctx) => {
			const isCreate = mode === "create";
			try {
				if (isCreate) {
					await createMutation.mutateAsync({
						data: {
							name: ctx.value.connectionName,
							url: ctx.value.connectionUrl,
						},
					});
					toaster.create({
						title: "Success",
						description:
							mode === "create"
								? "Connection created successfully"
								: "Connection updated successfully",
					});
				} else {
					await updateMutation.mutateAsync({
						data: {
							id: initialValues?.id || "",
							name: ctx.value.connectionName,
							url: ctx.value.connectionUrl,
						},
					});
					toaster.create({
						title: "Success",
						description: "Connection updated successfully",
					});
				}
				onSuccess?.();
			} catch (error) {
				toaster.create({
					title: "Error",
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
			values.connectionType = parsed.protocol as z.infer<typeof connectionType>;
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
		const port = parseInt(url.port, 10);
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
									{(field) => <field.TextField label="URL" />}
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

			<div className="flex justify-end gap-2 pt-4">
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
