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
// import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
// ModuleRegistry.registerModules([AllCommunityModule]);

/**
 * Safe binary encoding for URL-safe compression with Zipson
 */
function encodeToBinary(str: string): string {
	return btoa(
		encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function (_match, p1) {
			return String.fromCharCode(parseInt(p1, 16));
		}),
	);
}

/**
 * Safe binary decoding for URL-safe compression with Zipson
 */
function decodeFromBinary(str: string): string {
	return decodeURIComponent(
		Array.prototype.map
			.call(atob(str), function (c) {
				return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
			})
			.join(""),
	);
}

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
