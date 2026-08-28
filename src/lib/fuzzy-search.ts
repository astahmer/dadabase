import { rankItem } from "@tanstack/match-sorter-utils";

/** Stable fuzzy filtering used by table pickers and database navigation. */
export const fuzzyFilter = <T>(
  items: readonly T[],
  query: string,
  getText: (item: T) => string,
): T[] => {
  const normalized = query.trim().replaceAll(/[_\-.]+/g, " ");
  if (normalized === "") return [...items];

  return items
    .map((item, index) => ({
      item,
      index,
      ranking: rankItem(getText(item).replaceAll(/[_\-.]+/g, " "), normalized),
    }))
    .filter(({ ranking }) => ranking.passed)
    .toSorted((a, b) => b.ranking.rank - a.ranking.rank || a.index - b.index)
    .map(({ item }) => item);
};
