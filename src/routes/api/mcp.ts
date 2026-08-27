import { createFileRoute } from "@tanstack/react-router";

import { handleDadabaseMcpRequest } from "#src/server/mcp/mcp-server.ts";

export const Route = createFileRoute("/api/mcp")({
  server: {
    handlers: {
      GET: ({ request }) => handleDadabaseMcpRequest(request),
      POST: ({ request }) => handleDadabaseMcpRequest(request),
      DELETE: ({ request }) => handleDadabaseMcpRequest(request),
    },
  },
});
