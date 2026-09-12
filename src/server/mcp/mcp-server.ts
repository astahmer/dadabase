import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { Effect } from "effect";
import { z } from "zod";

import { DatabaseConnectionRepository } from "#src/db/database-connection.repository.ts";
import { DatabaseDialect, getDialectDefaultSchema } from "#src/db/dialect.ts";
import { isReadOnlyConnection } from "#src/lib/connection-security.ts";
import { withRemoteConnectionLayersFromUrl } from "#src/server/create-remote-server-fn.ts";
import { isSelectQuery } from "#src/server/introspection/detect-destructive-sql.ts";
import {
  executeCustomSql,
  getAllTablesColumns,
  getDatabaseObjects,
} from "#src/server/introspection/introspection.ts";
import { AppRuntime } from "#src/server/services/app.runtime.ts";
import { NanoId } from "#src/server/services/nano-id.ts";

const MAX_RESULT_ROWS = 100;
const MAX_SQL_LENGTH = 100_000;

const jsonResult = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
});

const safeConnectionUrl = (rawUrl: string) => {
  try {
    const url = new URL(rawUrl);
    if (url.password) url.password = "*****";
    for (const key of url.searchParams.keys()) {
      if (/auth|key|password|secret|token/i.test(key)) url.searchParams.set(key, "*****");
    }
    url.hash = "";
    return url.toString();
  } catch {
    return "[invalid connection URL]";
  }
};

const findConnection = async (name: string) =>
  AppRuntime.runPromise(
    Effect.gen(function* () {
      const repository = yield* DatabaseConnectionRepository;
      const connection = yield* repository.findByName(name);
      if (!connection) throw new Error(`Connection not found: ${name}`);
      return connection;
    }),
  );

const runRead = async (connectionUrl: string, sql: string) => {
  const program = Effect.gen(function* () {
    const result = yield* executeCustomSql({ sql, skipQueryLog: true });
    const rows = result.rows.slice(0, MAX_RESULT_ROWS).map((row) => {
      const record: Record<string, unknown> = {};
      for (const column of result.columns) {
        record[column] = (row as Record<string, unknown>)[column];
      }
      return record;
    });
    return {
      columns: result.columns,
      rows,
      rowCount: result.rowCount,
      truncated: result.rows.length > MAX_RESULT_ROWS,
      rowsAffected: result.rowsAffected ?? null,
    };
  }).pipe(withRemoteConnectionLayersFromUrl(connectionUrl));

  return AppRuntime.runPromise(program as never);
};

export const createDadabaseMcpServer = () => {
  const server = new McpServer({ name: "dadabase", version: "0.1.0" });

  server.registerTool(
    "list_connections",
    {
      title: "List Dadabase connections",
      description: "List saved database connections without exposing credentials.",
    },
    async () => {
      const connections = await AppRuntime.runPromise(
        Effect.gen(function* () {
          const repository = yield* DatabaseConnectionRepository;
          return yield* repository.findAll();
        }),
      );
      return jsonResult(
        connections.map((connection) => ({
          id: connection.id,
          name: connection.name,
          dialect: connection.dialect,
          endpoint: safeConnectionUrl(connection.url),
        })),
      );
    },
  );

  server.registerTool(
    "add_connection",
    {
      title: "Add a Dadabase connection",
      description:
        "Save a database connection. This changes Dadabase configuration; call with approved=true only after the user asks to add it. Results redact passwords.",
      inputSchema: {
        name: z.string().trim().min(1).max(120),
        url: z.string().trim().min(1).max(4096),
        dialect: z.enum(DatabaseDialect),
        approved: z.boolean(),
      },
    },
    async ({ name, url, dialect, approved }) => {
      if (!approved) {
        return jsonResult({
          ok: false,
          needsApproval: true,
          message:
            "Connection was not saved. Call again with approved=true after user confirmation.",
        });
      }
      const result = await AppRuntime.runPromise(
        Effect.gen(function* () {
          const repository = yield* DatabaseConnectionRepository;
          const nanoId = yield* NanoId;
          const id = yield* nanoId.generate("db_conn");
          const now = Date.now();
          yield* repository.insert({
            id,
            name,
            url,
            dialect,
            created_at: now,
            updated_at: now,
          });
          return { id, name, dialect, endpoint: safeConnectionUrl(url) };
        }),
      );
      return jsonResult({ ok: true, connection: result });
    },
  );

  server.registerTool(
    "edit_connection",
    {
      title: "Edit a Dadabase connection",
      description:
        "Change a saved connection's name, URL, or dialect. This changes Dadabase configuration; call with approved=true only after the user asks to edit it. Results redact passwords.",
      inputSchema: {
        id: z.string().min(1),
        name: z.string().trim().min(1).max(120),
        url: z.string().trim().min(1).max(4096),
        dialect: z.enum(DatabaseDialect),
        approved: z.boolean(),
      },
    },
    async ({ id, name, url, dialect, approved }) => {
      if (!approved) {
        return jsonResult({
          ok: false,
          needsApproval: true,
          message:
            "Connection was not changed. Call again with approved=true after user confirmation.",
        });
      }
      const result = await AppRuntime.runPromise(
        Effect.gen(function* () {
          const repository = yield* DatabaseConnectionRepository;
          const connections = yield* repository.findAll();
          if (!connections.some((connection) => connection.id === id)) return null;
          yield* repository.update({ id, name, url, dialect });
          return { id, name, dialect, endpoint: safeConnectionUrl(url) };
        }),
      );
      if (!result) return jsonResult({ ok: false, error: "Connection not found." });
      return jsonResult({ ok: true, connection: result });
    },
  );

  server.registerTool(
    "describe_schema",
    {
      title: "Describe a database schema",
      description: "Return tables, columns, keys, views, functions, procedures, and triggers.",
      inputSchema: {
        connectionName: z.string().min(1),
        schema: z.string().optional(),
      },
    },
    async ({ connectionName, schema }) => {
      const connection = await findConnection(connectionName);
      const resolvedSchema = schema || getDialectDefaultSchema(connection.dialect);
      const result = await AppRuntime.runPromise(
        Effect.all({
          tables: getAllTablesColumns({ schema: resolvedSchema }),
          objects: getDatabaseObjects({ schema: resolvedSchema }),
        }).pipe(withRemoteConnectionLayersFromUrl(connection.url)),
      );
      return jsonResult({ connection: connectionName, schema: resolvedSchema, ...result });
    },
  );

  server.registerTool(
    "query_database",
    {
      title: "Query a Dadabase connection",
      description:
        "Run a bounded SQL query. SELECT/WITH are read-only; mutations require approved=true and are still blocked for read-only connections.",
      inputSchema: {
        connectionName: z.string().min(1),
        sql: z.string().min(1).max(MAX_SQL_LENGTH),
        approved: z.boolean().optional(),
      },
    },
    async ({ connectionName, sql, approved }) => {
      const connection = await findConnection(connectionName);
      const readOnly = isSelectQuery(sql);
      if (!readOnly && !approved) {
        return jsonResult({
          ok: false,
          needsApproval: true,
          message: "Mutation withheld. Call again with approved=true after user confirmation.",
        });
      }
      if (!readOnly && isReadOnlyConnection(connection.url)) {
        return jsonResult({ ok: false, error: "This connection is read-only." });
      }
      return jsonResult({
        ok: true,
        connection: connectionName,
        result: await runRead(connection.url, sql),
      });
    },
  );

  return server;
};

type McpSession = {
  server: McpServer;
  transport: WebStandardStreamableHTTPServerTransport;
};

const sessions = new Map<string, McpSession>();

const isAuthorized = (request: Request) => {
  const configuredToken = process.env.DADABASE_MCP_TOKEN;
  if (!configuredToken) return true;
  return request.headers.get("authorization") === `Bearer ${configuredToken}`;
};

export const handleDadabaseMcpRequest = async (request: Request) => {
  if (!isAuthorized(request)) return new Response("Unauthorized", { status: 401 });
  if (process.env.DADABASE_MCP_ENABLED === "false") {
    return new Response("Dadabase MCP is disabled.", { status: 404 });
  }

  const sessionId = request.headers.get("mcp-session-id");
  let session = sessionId ? sessions.get(sessionId) : undefined;

  if (!session) {
    if (request.method !== "POST") {
      return new Response("MCP session not initialized.", { status: 400 });
    }
    const server = createDadabaseMcpServer();
    let initializedId: string | undefined;
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => globalThis.crypto.randomUUID(),
      enableJsonResponse: true,
      onsessioninitialized: (id) => {
        initializedId = id;
      },
      onsessionclosed: (id) => {
        sessions.delete(id);
      },
    });
    session = { server, transport };
    await server.connect(transport);
    const response = await transport.handleRequest(request);
    if (initializedId) sessions.set(initializedId, session);
    return response;
  }

  return session.transport.handleRequest(request);
};
