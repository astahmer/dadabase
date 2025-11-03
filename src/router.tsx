import { createRouter } from "@tanstack/react-router";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { ToasterProvider } from "./components/ui/toaster.tsx";
import * as TanstackQuery from "./integrations/tanstack-query/root-provider";
import { routeTree } from "./routeTree.gen";
// import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
// ModuleRegistry.registerModules([AllCommunityModule]);

// Create a new router instance
export const getRouter = () => {
	const rqContext = TanstackQuery.getContext();

	const router = createRouter({
		routeTree,
		context: { ...rqContext },
		defaultPreload: "intent",
		Wrap: (props: { children: React.ReactNode }) => {
			return (
				<TanstackQuery.Provider {...rqContext}>
					<ToasterProvider />
					{props.children}
				</TanstackQuery.Provider>
			);
		},
	});

	setupRouterSsrQueryIntegration({
		router,
		queryClient: rqContext.queryClient,
	});

	return router;
};
