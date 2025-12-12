import { scan } from "react-scan";
import { TanStackDevtools } from "@tanstack/react-devtools";
import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

scan({
	enabled: true,
});

export const WithDevtools = () => (
	<TanStackDevtools
		config={{
			position: "bottom-right",
		}}
		plugins={[
			{
				name: "Tanstack Router",
				render: <TanStackRouterDevtoolsPanel />,
			},
			{
				name: "Tanstack Query",
				render: <ReactQueryDevtoolsPanel />,
			},
		]}
	/>
);
