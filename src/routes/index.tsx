import { HomePage } from "#src/components/pages/home.page.tsx";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  // loader: () => getSavedConnectionsServerFn(),
  component: HomePage,
});
