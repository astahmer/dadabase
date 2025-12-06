import {
	createRouter,
	parseSearchWith,
	stringifySearchWith,
} from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { stringify, parse } from "zipson";
import { ToasterProvider } from "./components/ui/toaster.tsx";
import { routeTree } from "./routeTree.gen";
import { queryClient } from "./query-client.ts";
import { QueryClientProvider } from "@tanstack/react-query";
import { Spinner } from "./components/ui/spinner.tsx";
import { FullCenter } from "./components/ui/layout.tsx";
import { decodeFromBinary, encodeToBinary } from "./router.encode.ts";
// import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
// ModuleRegistry.registerModules([AllCommunityModule]);

// Create a new router instance
export const getRouter = () => {
	const rqContext = { queryClient };

	const router = createRouter({
		routeTree,
		context: { ...rqContext },
		defaultStructuralSharing: true,
		defaultPreload: "intent",
		defaultPendingComponent: () => (
			<FullCenter>
				<Spinner />
			</FullCenter>
		),
		parseSearch: parseSearchWith((value) => parse(decodeFromBinary(value))),
		stringifySearch: stringifySearchWith((value) =>
			encodeToBinary(stringify(value)),
		),
		Wrap: (props: { children: React.ReactNode }) => {
			return (
				<QueryClientProvider client={queryClient}>
					<ToasterProvider />
					{props.children}
				</QueryClientProvider>
			);
		},
	});

	setupRouterSsrQueryIntegration({
		router,
		queryClient: rqContext.queryClient,
	});

	return router;
};
