import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { ToasterProvider } from "./components/ui/toaster.tsx";
import { routeTree } from "./routeTree.gen";
import { queryClient } from "./query-client.ts";
import { QueryClientProvider } from "@tanstack/react-query";
// import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
// ModuleRegistry.registerModules([AllCommunityModule]);

// Create a new router instance
export const getRouter = () => {
	const rqContext = { queryClient };

	const router = createRouter({
		routeTree,
		context: { ...rqContext },
		defaultPreload: "intent",
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
