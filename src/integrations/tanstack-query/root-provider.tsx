import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./query-client.ts";

export function getContext() {
	return {
		queryClient,
	};
}

export function Provider({
	children,
	queryClient,
}: {
	children: React.ReactNode;
	queryClient: QueryClient;
}) {
	return (
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	);
}
