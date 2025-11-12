import { useCallback, useState } from "react";
import type { RowRelationshipExpansionState } from "../types/relationships";

interface UseRelationshipExpansionStateResult {
	expandedState: RowRelationshipExpansionState;
	toggleExpansion: (rowId: string, relationshipId: string) => void;
	isExpanded: (rowId: string, relationshipId: string) => boolean;
	expandRelationship: (rowId: string, relationshipId: string) => void;
	collapseRelationship: (rowId: string, relationshipId: string) => void;
	collapseAllForRow: (rowId: string) => void;
}

/**
 * Hook to manage which relationships are expanded for each row
 * Tracks expansion state per row and per relationship
 */
export const useRelationshipExpansionState =
	(): UseRelationshipExpansionStateResult => {
		const [expandedState, setExpandedState] =
			useState<RowRelationshipExpansionState>({});

		const toggleExpansion = useCallback(
			(rowId: string, relationshipId: string) => {
				setExpandedState((prev) => {
					const rowExpanded = prev[rowId] ?? new Set();
					const newSet = new Set(rowExpanded);

					if (newSet.has(relationshipId)) {
						newSet.delete(relationshipId);
					} else {
						newSet.add(relationshipId);
					}

					return {
						...prev,
						[rowId]: newSet,
					};
				});
			},
			[],
		);

		const isExpanded = useCallback(
			(rowId: string, relationshipId: string): boolean => {
				return expandedState[rowId]?.has(relationshipId) ?? false;
			},
			[expandedState],
		);

		const expandRelationship = useCallback(
			(rowId: string, relationshipId: string) => {
				setExpandedState((prev) => {
					const rowExpanded = prev[rowId] ?? new Set();
					if (!rowExpanded.has(relationshipId)) {
						return {
							...prev,
							[rowId]: new Set([...rowExpanded, relationshipId]),
						};
					}
					return prev;
				});
			},
			[],
		);

		const collapseRelationship = useCallback(
			(rowId: string, relationshipId: string) => {
				setExpandedState((prev) => {
					const rowExpanded = prev[rowId] ?? new Set();
					const newSet = new Set(rowExpanded);
					newSet.delete(relationshipId);
					// If the set is empty, don't include the row at all
					if (newSet.size === 0) {
						const { [rowId]: _, ...rest } = prev;
						return rest as RowRelationshipExpansionState;
					}
					return {
						...prev,
						[rowId]: newSet,
					};
				});
			},
			[],
		);
		const collapseAllForRow = useCallback((rowId: string) => {
			setExpandedState((prev) => {
				const { [rowId]: _, ...rest } = prev;
				return rest as RowRelationshipExpansionState;
			});
		}, []);
		return {
			expandedState,
			toggleExpansion,
			isExpanded,
			expandRelationship,
			collapseRelationship,
			collapseAllForRow,
		};
	};
