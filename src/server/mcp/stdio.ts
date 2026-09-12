import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { createDadabaseMcpServer } from "#src/server/mcp/mcp-server.ts";

if (process.env.DADABASE_MCP_ENABLED === "false") {
  throw new Error("Dadabase MCP is disabled.");
}

const server = createDadabaseMcpServer();
await server.connect(new StdioServerTransport());
