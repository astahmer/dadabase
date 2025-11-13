import { useQuery } from "@tanstack/react-query";
import type { RelationshipMetadata } from "../types/relationships";
import { getTableRelationshipsQueryOptions } from "../server/pg/start-fns/get-table-relationships.start.ts";

interface UseTableRelationshipsOptions {
	url: string;
	schema: string;
	table: string;
}

interface UseTableRelationshipsResult {
	incomingReferences: RelationshipMetadata[];
	outgoingForeignKeys: RelationshipMetadata[];
	isLoading: boolean;
	isError: boolean;
	error: Error | null;
}

/**
 * Fetch all relationships for a table (both incoming and outgoing)
 * Uses a single backend query that efficiently fetches both types of relationships
 */
export const useTableRelationships = ({
	url,
	schema,
	table,
}: UseTableRelationshipsOptions): UseTableRelationshipsResult => {
	const relationshipsQuery = useQuery(
		getTableRelationshipsQueryOptions({
			url,
			schema,
			table,
		}),
	);

	// Transform backend results to RelationshipMetadata
	const incomingReferences: RelationshipMetadata[] = (
		relationshipsQuery.data ?? []
	).filter((rel) => rel.type === "incoming");

	const outgoingForeignKeys: RelationshipMetadata[] = (
		relationshipsQuery.data ?? []
	).filter((rel) => rel.type === "outgoing");

	return {
		incomingReferences,
		outgoingForeignKeys,
		isLoading: relationshipsQuery.isLoading,
		isError: relationshipsQuery.isError,
		error: relationshipsQuery.error,
	};
};
