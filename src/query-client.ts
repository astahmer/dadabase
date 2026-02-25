import type { QueryObserverOptions } from "@tanstack/react-query";

import { debounce } from "@tanstack/react-pacer";
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      // retry: (failureCount, error) => {
      // 	console.log("Retrying query", error);
      // 	console.log(error.name, error.cause, error);
      // 	if (error.name === "AbortError") return false;
      // 	if (error.name === "FetchError") return false;
      // 	return failureCount < 3;
      // },
    },
  },
  queryCache: new QueryCache({
    onSuccess: debounce(
      (_data, query) => {
        if (query.queryKey.at(0) === "remote" && query.queryKey.at(1) === "rows") {
          queryClient.invalidateQueries({
            queryKey: ["app", "queryHistory"],
          });
        }
      },
      { wait: 300 },
    ),
  }),
  mutationCache: new MutationCache({
    onSuccess: async (_data, _variables, _context, mutation) => {
      if (mutation.meta?.noInvalidate) return;

      await queryClient.invalidateQueries(
        {
          predicate: (query) => {
            if ((query.options as QueryObserverOptions).staleTime === Number.POSITIVE_INFINITY) {
              return false;
            }

            // Why do we invalidate everything ? cause it's hard to track which mutation is linked to which queries, more details below
            // https://x.com/alexdotjs/status/1744467890277921095
            // https://tkdodo.eu/blog/automatic-query-invalidation-after-mutations

            // invalidate all matching tags at once or everything if no meta is provided
            // return (
            // 	mutation.meta?.invalidates?.some((queryKey) =>
            // 		matchQuery({ queryKey }, query),
            // 	) ?? true
            // );
            return true;
          },
        },
        { cancelRefetch: false, throwOnError: false },
      );
    },
  }),
});
