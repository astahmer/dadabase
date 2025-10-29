import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "#src/components/pages/home.page.tsx";
import { getSavedConnectionsServerFn } from "#src/server-fns/get-saved-connections.server.ts";

export const Route = createFileRoute("/")({
	loader: () => getSavedConnectionsServerFn(),
	component: HomePage,
});
