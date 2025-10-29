import { useStore } from "@tanstack/react-form";
import z from "zod";
import { useAppForm } from "../form/form.hook.ts";
import { stack, Stack } from "../ui/layout.tsx";
import { toaster } from "../ui/toaster.tsx";
import { Card } from "../ui/card.tsx";
import { useServerFn } from "@tanstack/react-start";
import { getAvailableDatabaseListServerFn } from "#src/server-fns/get-available-database-list.server.ts";
import { useLoaderData } from "@tanstack/react-router";

const schema = z.object({
	connectionType: z.enum(["postgres", "mysql", "sqlite"]),
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
	const savedDatabaseList = useLoaderData({ from: "/" });
	return (
		<Stack>
			{savedDatabaseList.map((savedDatabase) => (
				<div key={savedDatabase.id}>{savedDatabase.url}</div>
			))}
			<SimpleForm />
		</Stack>
	);
};

function SimpleForm() {
	const getDbList = useServerFn(getAvailableDatabaseListServerFn);

	const form = useAppForm({
		defaultValues: {
			connectionType: "" as z.infer<typeof schema>["connectionType"],
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
			// TODO server fn connection?
			console.log(ctx.value);
			// Show success message
			// alert("Form submitted successfully!");
			const res = await getDbList({ data: { url: ctx.value.connectionUrl } });
			console.log(res);
		},
	});

	return (
		<Stack className="min-h-screen" justify="center">
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
										<form.AppField name="connectionUrl">
											{(field) => <field.TextField label="Connection URL" />}
										</form.AppField>
									</div>
									<hr className="col-span-2" />
									<div className="col-span-2">Or</div>
									<form.AppField
										name="host"
										listeners={{
											onChange: (props) => {
												const connectionType =
													form.getFieldValue("connectionType");
												const host = props.value;
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
												console.log(connectionType, url);

												form.setFieldValue("connectionUrl", url);
											},
										}}
									>
										{(field) => <field.TextField label="Host" />}
									</form.AppField>
									<form.AppField name="port">
										{(field) => <field.TextField type="number" label="Port" />}
									</form.AppField>
									<div className="col-span-2">
										<form.AppField name="databaseName">
											{(field) => <field.TextField label="Database name" />}
										</form.AppField>
									</div>
									<form.AppField name="user">
										{(field) => <field.TextField label="User" />}
									</form.AppField>
									<form.AppField name="password">
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
