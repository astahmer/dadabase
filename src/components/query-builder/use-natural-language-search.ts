import { useCallback } from "react";
import {
	parseNaturalLanguageQuery,
	type ParsedNLQuery,
} from "#src/components/query-builder/natural-language-parser.ts";

interface UseNaturalLanguageSearchOptions {
	onFiltersApplied?: (query: ParsedNLQuery) => void;
}

/**
 * Hook for natural language search functionality
 */
export function useNaturalLanguageSearch(
	options?: UseNaturalLanguageSearchOptions,
) {
	const parse = useCallback(
		(input: string, columns: string[]): ParsedNLQuery => {
			const result = parseNaturalLanguageQuery(input, columns);

			if (result.success && options?.onFiltersApplied) {
				options.onFiltersApplied(result);
			}

			return result;
		},
		[options],
	);

	return { parse };
}
