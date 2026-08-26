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
  component: RouteComponent,
});

function RouteComponent() {
  const { connectionName } = Route.useParams();

  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <Spinner />
        </div>
      }
    >
      <AiChatPage connectionName={connectionName} />
    </Suspense>
  );
}
