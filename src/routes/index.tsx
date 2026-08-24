import { createFileRoute } from "@tanstack/react-router";

import { HomePage } from "#src/components/pages/home.page.tsx";

export const Route = createFileRoute("/")({
  // loader: () => getSavedConnectionsServerFn(),
  component: HomePage,
});
