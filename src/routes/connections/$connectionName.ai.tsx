import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";

import { AiChatPage } from "#src/components/pages/connection-page/ai-chat.page.tsx";
import { Spinner } from "#src/components/ui/spinner.tsx";

/**
 * AI chat surface for one saved connection.
 *
 * Child route of `/connections/$connectionName` so the workspace shell
 * (sidebar + tabs bar) stays visible and only the main content region
 * swaps to the chat — ConnectionPage renders the matched child via <Outlet/>.
 */
export const Route = createFileRoute("/connections/$connectionName/ai")({
  // Audit S8: `?thread=<conversationId>` deep link from a seeded editor tab.
  // Audit K4: `?askTable=<name>` pre-seeds a draft + Selected schema scoped to
  // that table (`askTable`, not `table`, to avoid colliding with workspace
  // tab-state search keys).
  validateSearch: (search: Record<string, unknown>): {
    thread?: string;
    askTable?: string;
  } => {
    const thread = search.thread;
    const askTable = search.askTable;
    return {
      ...(typeof thread === "string" && thread !== "" ? { thread } : {}),
      ...(typeof askTable === "string" && askTable !== "" ? { askTable } : {}),
    };
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { connectionName } = Route.useParams();
  const { thread: initialConversationId, askTable: initialAskTable } = Route.useSearch();

  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <Spinner />
        </div>
      }
    >
      <AiChatPage
        connectionName={connectionName}
        initialConversationId={initialConversationId}
        initialAskTable={initialAskTable}
      />
    </Suspense>
  );
}
