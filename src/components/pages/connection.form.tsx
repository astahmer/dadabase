import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LucideCheck, LucideCross } from "lucide-react";
import { useState } from "react";
import z from "zod";

import {
  Accordion,
  AccordionItem,
  AccordionItemContent,
  AccordionItemTrigger,
} from "#src/components/ui/accordion";
import { DatabaseDialect } from "#src/db/dialect.ts";
import { buildConnectionUrl, isValidConnectionTarget } from "#src/lib/connection-form-url.ts";
import {
  isReadOnlyConnection,
  parseSslMode,
  parseSshTunnelFromUrl,
  stripDadabaseMarkerParams,
  type SslMode,
} from "#src/lib/connection-security.ts";
import { createDbConnectionMutation } from "#src/server/db-connection/start-fns/create-db-connection.start.ts";
import { updateDbConnectionMutation } from "#src/server/db-connection/start-fns/update-db-connection.start.ts";
import { tryConnectionServerFn } from "#src/server/introspection/start-fns/try-connection.start.ts";

import { useAppForm } from "../form/form.hook.ts";
import { Button } from "../ui/button.tsx";
import { Checkbox, CheckboxControl } from "../ui/checkbox.tsx";
import { HStack, Stack } from "../ui/layout.tsx";
import { toaster } from "../ui/toaster.tsx";

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
    readOnly: z.boolean(),
    sslMode: z.enum(["disable", "require", "verify-full"]).nullable(),
    sshHost: z.string(),
    sshPort: z.number(),
    sshUser: z.string(),
    sshPrivateKeyPath: z.string(),
    sshPassword: z.string(),
  })
  .refine(
    (data) => {
      return isValidConnectionTarget(data);
    },
    {
      message: "Invalid connection configuration for selected type",
      path: ["connectionUrl"],
    },
  );

const defaultValues = {
  connectionName: "",
  connectionType: DatabaseDialect.Postgres as z.infer<typeof connectionType>,
  filePath: "",
  libsqlAuthToken: "",
  connectionUrl: "",
  host: "",
  port: 5432,
  databaseName: "",
  user: "",
  password: "",
  readOnly: true,
  sslMode: null as SslMode | null,
  sshHost: "",
  sshPort: 22,
  sshUser: "",
  sshPrivateKeyPath: "",
  sshPassword: "",
};

export type ConnectionFormValues = z.infer<typeof connectionFormSchema>;

interface ConnectionFormProps {
  mode?: "create" | "edit";
  initialValues?: ConnectionFormValues & { id?: string };
  onSuccess?: (connectionName?: string) => void;
}

export function ConnectionForm({ mode = "create", initialValues, onSuccess }: ConnectionFormProps) {
  const createMutation = useMutation(createDbConnectionMutation);
  const updateMutation = useMutation(updateDbConnectionMutation);
  const testConnectionFn = useServerFn(tryConnectionServerFn);
  const [testState, setTestState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);

  const form = useAppForm({
    defaultValues: getInitialValues(),
    validators: {
      onChange: connectionFormSchema,
      onSubmit: connectionFormSchema,
    },
    onSubmitInvalid(props) {
      setSubmitError("Enter a name and a valid connection URL or database file path.");
      toaster.create({
        title: "Check connection details",
        description: "Enter a name and a valid connection URL or database file path.",
        type: "error",
      });
    },
    onSubmit: async (ctx) => saveConnection(ctx.value),
  });

  async function saveConnection(values: ConnectionFormValues) {
    const validation = connectionFormSchema.safeParse(values);
    if (!validation.success) {
      const message = "Enter a name and a valid connection URL or database file path.";
      setSubmitError(message);
      toaster.create({ title: "Check connection details", description: message, type: "error" });
      return;
    }

    setSubmitError(null);
    const connectionUrl = buildConnectionUrl(validation.data);

    try {
      if (mode === "create") {
        await createMutation.mutateAsync({
          data: {
            name: validation.data.connectionName,
            url: connectionUrl,
            dialect: validation.data.connectionType,
          },
        });
        toaster.create({
          title: "Connection saved",
          description: "You can open it from the list.",
        });
        onSuccess?.(validation.data.connectionName);
        return;
      }

      await updateMutation.mutateAsync({
        data: {
          id: initialValues?.id || "",
          name: validation.data.connectionName,
          url: connectionUrl,
        },
      });
      toaster.create({ title: "Connection updated" });
      onSuccess?.();
    } catch {
      toaster.create({ title: "Could not save connection", type: "error" });
    }
  }

  function getInitialValues() {
    if (mode === "create") {
      return defaultValues;
    }

    const values = { ...defaultValues, ...initialValues };
    if (initialValues?.connectionUrl) {
      values.readOnly = isReadOnlyConnection(initialValues.connectionUrl);
      values.sslMode = parseSslMode(initialValues.connectionUrl);
      const ssh = parseSshTunnelFromUrl(initialValues.connectionUrl);
      if (ssh) {
        values.sshHost = ssh.host;
        values.sshPort = ssh.port;
        values.sshUser = ssh.user;
        values.sshPrivateKeyPath = ssh.privateKeyPath ?? "";
        values.sshPassword = ssh.password ?? "";
      }
      values.connectionUrl = stripDadabaseMarkerParams(initialValues.connectionUrl);
      // also strip sslmode for display of base URL fields
      try {
        const u = new URL(values.connectionUrl);
        u.searchParams.delete("sslmode");
        values.connectionUrl = u.toString();
      } catch {
        /* keep */
      }
      const parsed = parseConnectionUrl(values.connectionUrl);
      values.connectionType =
        initialValues.connectionType || (parsed.protocol as z.infer<typeof connectionType>);
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

      form.setFieldValue("connectionType", parsed.protocol as z.infer<typeof connectionType>);
      form.setFieldValue("user", parsed.user);
      form.setFieldValue("password", parsed.password);
      form.setFieldValue("host", parsed.host);
      form.setFieldValue("port", parsed.port);
      form.setFieldValue("databaseName", parsed.databaseName);
    } catch (e) {
      console.error("Invalid connection URL:", e);
    }
  }

  function ReadOnlyField() {
    return (
      <form.AppField name="readOnly">
        {(field) => (
          <label className="border-primary/20 bg-primary/5 flex items-start gap-3 rounded-md border p-3 text-sm">
            <Checkbox
              checked={field.state.value}
              onCheckedChange={(details) => field.handleChange(!!details.checked)}
              data-testid="connection-readonly-checkbox"
            >
              <CheckboxControl />
            </Checkbox>
            <span>
              <span className="text-foreground block font-medium">Read-only connection</span>
              <span className="text-muted-foreground block leading-5">
                Blocks writes and schema changes. Turn this off only when you intend to edit data.
              </span>
            </span>
          </label>
        )}
      </form.AppField>
    );
  }

  function submitForm() {
    const validation = connectionFormSchema.safeParse(form.state.values);
    if (!validation.success) {
      const message = "Enter a name and a valid connection URL or database file path.";
      setSubmitError(message);
      toaster.create({ title: "Check connection details", description: message, type: "error" });
      return;
    }
    void saveConnection(validation.data);
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
      {submitError ? (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive/10 text-foreground rounded-md border p-3 text-sm"
        >
          <p className="font-medium">Check connection details</p>
          <p className="text-muted-foreground mt-1">{submitError}</p>
        </div>
      ) : null}
      <form.AppField name="connectionType">
        {(field) => (
          <field.Select
            label="Type"
            defaultValue={[field.state.value]}
            options={[
              { label: "Postgres", value: "postgres" },
              { label: "MySQL / MariaDB", value: "mysql" },
              { label: "SQLite", value: "sqlite" },
              { label: "libSQL / Turso", value: "libsql" },
              { label: "DuckDB", value: "duckdb" },
            ]}
          />
        )}
      </form.AppField>

      <form.Subscribe
        selector={(state) => ({
          connectionType: state.values.connectionType,
          connectionUrl: state.values.connectionUrl,
          filePath: state.values.filePath,
        })}
      >
        {({ connectionType, connectionUrl, filePath }) => {
          const label =
            connectionType === DatabaseDialect.SQLite || connectionType === DatabaseDialect.DuckDB
              ? filePath
                ? connectionType === DatabaseDialect.SQLite
                  ? "Local SQLite file selected"
                  : "Local DuckDB file selected"
                : "Choose a local database file"
              : (() => {
                  try {
                    const parsed = new URL(connectionUrl);
                    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
                  } catch {
                    return "Paste a URL or fill in the connection fields";
                  }
                })();

          return (
            <div
              className="border-border/70 bg-muted/30 rounded-md border px-3 py-2 text-xs"
              data-testid="connection-target-preview"
            >
              <span className="text-muted-foreground">Connection target: </span>
              <span className="text-foreground font-mono">{label}</span>
              <span className="text-muted-foreground ml-2">Credentials are never shown here.</span>
            </div>
          );
        }}
      </form.Subscribe>

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
                    <field.TextField label="File Path" placeholder="/path/to/database.db" />
                  )}
                </form.AppField>
                <ReadOnlyField />
              </>
            );
          }

          if (connectionType === DatabaseDialect.DuckDB) {
            return (
              <>
                <form.AppField name="connectionName">
                  {(field) => <field.TextField label="Name" />}
                </form.AppField>
                <form.AppField name="filePath">
                  {(field) => (
                    <field.TextField
                      label="Database File Path"
                      placeholder="/path/to/database.duckdb"
                    />
                  )}
                </form.AppField>
                <p className="text-muted-foreground text-xs">
                  Embedded analytics database — point at an existing `.duckdb` file.
                </p>
                <ReadOnlyField />
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
                    <field.TextField label="URL" placeholder="libsql://your-database.turso.io" />
                  )}
                </form.AppField>
                <form.AppField name="libsqlAuthToken">
                  {(field) => (
                    <field.TextField
                      type="password"
                      label="Auth Token (optional)"
                      placeholder="your-auth-token"
                    />
                  )}
                </form.AppField>
                <ReadOnlyField />
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
                      const type = form.getFieldValue("connectionType");
                      const prefix = type === DatabaseDialect.MySQL ? "mysql://" : "postgres://";
                      if (
                        !props.value.startsWith("postgres://") &&
                        !props.value.startsWith("mysql://")
                      ) {
                        form.setFieldValue("connectionUrl", `${prefix}${props.value}`);
                      }
                    },
                    onBlur: (props) => {
                      updateFieldsFromConnectionUrl(props.value);
                    },
                  }}
                >
                  {(field) => (
                    <field.TextField label="URL" placeholder="postgres://user:pass@host:5432/db" />
                  )}
                </form.AppField>
                <span className="text-muted-foreground text-xs">
                  Paste a connection URL, or build one from individual fields.
                </span>
              </Stack>

              <Accordion collapsible className="overflow-hidden rounded-md border">
                <AccordionItem value="or-fields" className="w-full">
                  <AccordionItemTrigger className="hover:bg-muted/50 px-3 py-2 text-sm transition-colors">
                    <span className="font-medium">Host / Port / Database / User / Password</span>
                  </AccordionItemTrigger>
                  <AccordionItemContent className="bg-muted/30 space-y-3 border-t px-3 py-3">
                    <div className="grid w-full grid-cols-2 gap-2">
                      <form.AppField name="host" listeners={{ onChange: updateConnectionUrl }}>
                        {(field) => <field.TextField label="Host" />}
                      </form.AppField>
                      <form.AppField name="port" listeners={{ onChange: updateConnectionUrl }}>
                        {(field) => <field.TextField type="number" label="Port" />}
                      </form.AppField>
                      <div className="col-span-2">
                        <form.AppField
                          name="databaseName"
                          listeners={{ onChange: updateConnectionUrl }}
                        >
                          {(field) => <field.TextField label="Database" />}
                        </form.AppField>
                      </div>
                      <form.AppField name="user" listeners={{ onChange: updateConnectionUrl }}>
                        {(field) => <field.TextField label="User" />}
                      </form.AppField>
                      <form.AppField name="password" listeners={{ onChange: updateConnectionUrl }}>
                        {(field) => <field.TextField type="password" label="Password" />}
                      </form.AppField>
                    </div>
                  </AccordionItemContent>
                </AccordionItem>
                <AccordionItem value="security" className="w-full border-t">
                  <AccordionItemTrigger className="hover:bg-muted/50 px-3 py-2 text-sm transition-colors">
                    <span className="font-medium">Security (SSL / SSH)</span>
                  </AccordionItemTrigger>
                  <AccordionItemContent className="bg-muted/30 space-y-3 border-t px-3 py-3">
                    <p className="text-muted-foreground text-xs leading-5">
                      Use <span className="text-foreground font-medium">Require</span> for most
                      hosted databases. Choose{" "}
                      <span className="text-foreground font-medium">Verify full</span> only when the
                      server certificate hostname is configured.
                    </p>
                    <form.AppField name="sslMode">
                      {(field) => (
                        <field.Select
                          label="SSL mode"
                          defaultValue={field.state.value ? [field.state.value] : []}
                          options={[
                            { label: "disable", value: "disable" },
                            { label: "require", value: "require" },
                            { label: "verify-full", value: "verify-full" },
                          ]}
                        />
                      )}
                    </form.AppField>
                    <p className="text-muted-foreground text-xs leading-5">
                      Need a bastion? Enter its SSH details below. Prefer a private key; use a
                      password only when your server requires it.
                    </p>
                    <div className="grid w-full grid-cols-2 gap-2">
                      <form.AppField name="sshHost">
                        {(field) => <field.TextField label="SSH host" />}
                      </form.AppField>
                      <form.AppField name="sshPort">
                        {(field) => <field.TextField type="number" label="SSH port" />}
                      </form.AppField>
                      <form.AppField name="sshUser">
                        {(field) => <field.TextField label="SSH user" />}
                      </form.AppField>
                      <form.AppField name="sshPrivateKeyPath">
                        {(field) => <field.TextField label="Private key path" />}
                      </form.AppField>
                      <form.AppField name="sshPassword">
                        {(field) => (
                          <field.TextField type="password" label="SSH password (optional)" />
                        )}
                      </form.AppField>
                    </div>
                    <p className="text-muted-foreground text-xs">
                      SSH settings are stored on the connection URL (`dadabase_ssh`). Provide a
                      private key path and/or password. Tunneling opens server-side when the pool is
                      created.
                    </p>
                  </AccordionItemContent>
                </AccordionItem>
              </Accordion>
              <ReadOnlyField />
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
            try {
              const connectionType = form.getFieldValue("connectionType");
              const filePath = form.getFieldValue("filePath");
              const connectionUrl = buildConnectionUrl({
                connectionType,
                filePath,
                libsqlAuthToken: form.getFieldValue("libsqlAuthToken"),
                connectionUrl: form.getFieldValue("connectionUrl"),
                readOnly: form.getFieldValue("readOnly"),
                sslMode: form.getFieldValue("sslMode"),
                sshHost: form.getFieldValue("sshHost"),
                sshPort: form.getFieldValue("sshPort"),
                sshUser: form.getFieldValue("sshUser"),
                sshPrivateKeyPath: form.getFieldValue("sshPrivateKeyPath"),
                sshPassword: form.getFieldValue("sshPassword"),
              });

              if (
                !connectionUrl ||
                ((connectionType === DatabaseDialect.SQLite ||
                  connectionType === DatabaseDialect.DuckDB) &&
                  !filePath)
              ) {
                toaster.create({
                  title: "Connection details are required",
                  description: "Enter a valid connection URL or database file path before testing.",
                  type: "error",
                });
                return;
              }

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
            } catch {
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
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => (
            <Button
              type="button"
              data-testid="connection-save"
              disabled={isSubmitting}
              onClick={submitForm}
            >
              {mode === "create" ? "Save connection" : "Save changes"}
            </Button>
          )}
        </form.Subscribe>
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

  if (!host || !databaseName) return "";

  return `${connectionType}://${user}:${password}@${host}:${port}/${databaseName}`;
}
