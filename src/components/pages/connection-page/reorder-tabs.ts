import { arrayMove } from "@dnd-kit/sortable";

/**
 * Reorders tabs by moving the tab with `activeId` to the position of `overId`.
 * Returns the original array if either id is missing or they are the same.
 */
export const reorderTabs = <T extends { tabId: string }>(
  tabs: readonly T[],
  activeId: string,
  overId: string,
): T[] => {
  if (activeId === overId) {
    return [...tabs];
  }

  const oldIndex = tabs.findIndex((tab) => tab.tabId === activeId);
  const newIndex = tabs.findIndex((tab) => tab.tabId === overId);

  if (oldIndex === -1 || newIndex === -1) {
    return [...tabs];
  }

  return arrayMove([...tabs], oldIndex, newIndex);
};
