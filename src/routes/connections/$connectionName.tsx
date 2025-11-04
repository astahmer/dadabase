import { createFileRoute } from "@tanstack/react-router";
import { ConnectionPage } from "#src/components/pages/connection.page";

export const Route = createFileRoute("/connections/$connectionName")({
	component: RouteComponent,
});

function RouteComponent() {
	const { connectionName } = Route.useParams();
	return <ConnectionPage connectionName={connectionName} />;
}
