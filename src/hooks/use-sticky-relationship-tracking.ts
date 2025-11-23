import { useEffect, useState } from "react";
import type { TableRelationship } from "#src/types/relationships.ts";

export function useStickyRelationshipTracking(
	containerRef: React.RefObject<HTMLDivElement | null>,
	cardRefs: React.RefObject<Record<string, HTMLDivElement | null>>,
	displayedRelationships: Set<string>,
	relationships: TableRelationship[],
) {
	const [stickyRelationship, setStickyRelationship] = useState<string | null>(
		null,
	);

	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const sortedRels = relationships
			.filter((r) => displayedRelationships.has(r.constraintName))
			.sort((a, b) => {
				if (a.type === "outgoing" && b.type === "incoming") return -1;
				if (a.type === "incoming" && b.type === "outgoing") return 1;
				return 0;
			});

		const visibleCards = new Map<string, number>();

		const observer = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					const constraintName = entry.target.getAttribute("data-constraint");
					if (!constraintName) return;

					if (entry.isIntersecting) {
						visibleCards.set(
							constraintName,
							entry.boundingClientRect.top -
								container.getBoundingClientRect().top,
						);
					} else {
						visibleCards.delete(constraintName);
					}
				});

				let topmostCard: string | null = null;
				let smallestTop = Infinity;

				for (const [name, top] of visibleCards) {
					if (top <= smallestTop) {
						smallestTop = top;
						topmostCard = name;
					}
				}

				if (!topmostCard && sortedRels.length > 0) {
					topmostCard = sortedRels[0].constraintName;
				}

				if (topmostCard) {
					setStickyRelationship(topmostCard);
				}
			},
			{
				root: container,
				threshold: 0,
			},
		);

		Object.entries(cardRefs.current || {}).forEach(([constraintName, el]) => {
			if (el && displayedRelationships.has(constraintName)) {
				observer.observe(el);
			}
		});

		return () => observer.disconnect();
	}, [displayedRelationships, relationships, containerRef, cardRefs]);

	return stickyRelationship;
}
