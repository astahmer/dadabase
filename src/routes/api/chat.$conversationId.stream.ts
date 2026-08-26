import { createFileRoute } from "@tanstack/react-router";

/**
 * Stream-resume probe for persisted conversations (vendored runtime contract:
 * opening a conversation asks the server to resume an interrupted stream).
 *
 * Dadabase fully consumes every stream inside its initiating POST /api/chat
 * response and keeps no server-side registry of live generations, so there is
 * never anything to resume here — 204 tells the transport "nothing in flight"
 * so it renders persisted history instead of erroring (audit S1 hydration).
 */
export const Route = createFileRoute("/api/chat/$conversationId/stream")({
  server: {
    handlers: {
      GET: () => new Response(null, { status: 204 }),
    },
  },
});
