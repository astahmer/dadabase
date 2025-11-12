import { useQuery } from "@tanstack/react-query";
import type { RelationshipMetadata } from "../types/relationships";

interface UseTableRelationshipsOptions {
	url: string;
	schema: string;
	table: string;
	enabled?: boolean;
}

interface UseTableRelationshipsResult {
	incomingReferences: RelationshipMetadata[];
	outgoingForeignKeys: RelationshipMetadata[];
	isLoading: boolean;
	isError: boolean;
	error: Error | null;
}

/**
 * Fetch all relationships for a table
 * - Incoming: tables that reference this table
 * - Outgoing: tables this table references
 */
export const useTableRelationships = ({
	url,
	schema,
	table,
	enabled = true,
}: UseTableRelationshipsOptions): UseTableRelationshipsResult => {
	// Query incoming references (tables that have FK pointing to us)
	const incomingQuery = useQuery({
		queryKey: ["table-relationships", "incoming", url, schema, table],
		queryFn: async () => {
			// TODO: Implement API endpoint to fetch incoming references
			// Using findColumnReferences() from server
			return [] as RelationshipMetadata[];
		},
		enabled: enabled && !!url && !!schema && !!table,
		staleTime: 5 * 60 * 1000, // 5 minutes
	});

	// Query outgoing foreign keys (tables we reference)
	const outgoingQuery = useQuery({
		queryKey: ["table-relationships", "outgoing", url, schema, table],
		queryFn: async () => {
			// TODO: Implement API endpoint to fetch outgoing FKs
			// Using getTableForeignKeys() from server
			return [] as RelationshipMetadata[];
		},
		enabled: enabled && !!url && !!schema && !!table,
		staleTime: 5 * 60 * 1000,
	});

	return {
		incomingReferences: incomingQuery.data ?? [],
		outgoingForeignKeys: outgoingQuery.data ?? [],
		isLoading: incomingQuery.isLoading || outgoingQuery.isLoading,
		isError: incomingQuery.isError || outgoingQuery.isError,
		error: incomingQuery.error || outgoingQuery.error || null,
	};
};
