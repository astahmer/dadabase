import type { CSSProperties } from "react";

import { Portal } from "@ark-ui/react";
import { Editable, useEditable } from "@ark-ui/react/editable";
import { Tabs } from "@ark-ui/react/tabs";
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToHorizontalAxis } from "@dnd-kit/modifiers";
import { horizontalListSortingStrategy, SortableContext, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowLeftFromLine,
  ArrowLeftRight,
  ArrowRightFromLine,
  CircleXIcon,
  ClipboardIcon,
  CopyPlus,
  Edit2,
  PanelLeft,
  Plus,
  X,
} from "lucide-react";

import { Button } from "../../ui/button";
import { Menu, MenuContent, MenuContextTrigger, MenuItem } from "../../ui/menu";
import { Tooltip } from "../../ui/tooltip.tsx";
import { getTabTriggerStyles } from "./table-tabs-bar.styles.ts";

export interface TableTab {
  tabId: string; // Explicit unique identifier
  schema: string;
  table: string;
  tabName?: string; // User-defined tab name
  fkValue?: string; // Optional FK value used when navigating to this tab
}

interface TableTabsBarProps {
  tabs: Array<TableTab> | ReadonlyArray<TableTab>;
  hasMultipleSchemas: boolean;
  activeTabId: string | null;
  onTabChange: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onAddTab?: () => void;
  onTabHover?: (tab: TableTab) => void;
  onDuplicateTab?: (tabId: string) => void;
  onCloseTabsOnLeft?: (tabId: string) => void;
  onCloseTabsOnRight?: (tabId: string) => void;
  onCloseOtherTabs?: (tabId: string) => void;
  onCloseAllTabs?: () => void;
  onCopyTabUrl?: (tabId: string) => void;
  onRenameTab?: (tabId: string, newName: string) => void;
  onToggleSidebar?: () => void;
  isSidebarCollapsed?: boolean;
  onTabsReorder?: (activeTabId: string, overTabId: string) => void;
}

const TabItem = ({
  tab,
  index,
  isActive,
  hasMultipleSchemas,
  onTabClose,
  onTabHover,
  onRenameTab,
  onDuplicateTab,
  onCloseOtherTabs,
  onCloseTabsOnLeft,
  onCloseTabsOnRight,
  onCloseAllTabs,
  onCopyTabUrl,
  tabs,
}: {
  tab: TableTab;
  index: number;
  isActive: boolean;
  hasMultipleSchemas: boolean;
  onTabClose: (tabId: string) => void;
  onTabHover?: (tab: TableTab) => void;
  onRenameTab?: (tabId: string, newName: string) => void;
  onDuplicateTab?: (tabId: string) => void;
  onCloseOtherTabs?: (tabId: string) => void;
  onCloseTabsOnLeft?: (tabId: string) => void;
  onCloseTabsOnRight?: (tabId: string) => void;
  onCloseAllTabs?: (tabId: string) => void;
  onCopyTabUrl?: (tabId: string) => void;
  tabs: readonly TableTab[];
}) => {
  const defaultName =
    tab.schema && tab.table
      ? `${hasMultipleSchemas ? `${tab.schema}.` : ""}${tab.table}`
      : "New Tab";

  const displayName = tab.tabName || defaultName;
  const fkValueDisplay = tab.fkValue && tab.schema && tab.table ? ` [${tab.fkValue}]` : "";

  const editable = useEditable({
    value: tab.tabName || displayName,
    onValueChange: (details) => {
      if (details.value.trim()) {
        onRenameTab?.(tab.tabId, details.value.trim());
      }
    },
    activationMode: "dblclick",
    submitMode: "both",
    maxLength: 50,
  });

  const title =
    tab.schema && tab.table
      ? `${tab.schema && hasMultipleSchemas ? `${tab.schema}.` : ""}${tab.table}${tab.fkValue ? ` [${tab.fkValue}]` : ""}`
      : undefined;

  const sortable = useSortable({ id: tab.tabId });
  const dragStyle: CSSProperties = {
    opacity: sortable.isDragging ? 0.5 : 1,
    transform: CSS.Translate.toString(sortable.transform),
    transition: sortable.transition,
    zIndex: sortable.isDragging ? 1 : undefined,
  };

  return (
    <Menu key={tab.tabId}>
      <MenuContextTrigger asChild>
        <Tabs.Trigger
          value={tab.tabId}
          className={getTabTriggerStyles(isActive)}
          onMouseEnter={() => onTabHover?.(tab)}
          asChild
          data-table-tab={tab.tabId}
          data-table-tab-active={isActive ? true : undefined}
        >
          <div
            ref={sortable.setNodeRef}
            style={dragStyle}
            title={title}
            {...sortable.attributes}
            {...sortable.listeners}
          >
            <div className="flex items-center gap-1">
              <Editable.RootProvider value={editable}>
                <Editable.Preview className="truncate">{displayName}</Editable.Preview>
                <Editable.Input
                  className="truncate border-0 bg-transparent p-0 text-sm font-medium outline-none"
                  onKeyDown={(e) => {
                    // Stop propagation of arrow keys to prevent tab navigation
                    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                      e.stopPropagation();
                    }
                  }}
                />
              </Editable.RootProvider>
              {fkValueDisplay && (
                <span className="text-muted-foreground truncate text-xs italic">
                  {fkValueDisplay}
                </span>
              )}
            </div>
            <button
              className="hover:bg-destructive/20 hover:text-destructive flex items-center justify-center rounded p-0.5"
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(tab.tabId);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label="Close tab"
              type="button"
            >
              <X className="h-3! w-3!" />
            </button>
          </div>
        </Tabs.Trigger>
      </MenuContextTrigger>
      <Portal>
        <MenuContent className="z-10 w-48">
          <MenuItem value="rename" onClick={() => editable.edit()}>
            <Edit2 className="h-3! w-3!" />
            <span>Rename</span>
          </MenuItem>
          <div className="bg-border my-1 h-px" />
          <MenuItem value="close" onClick={() => onTabClose?.(tab.tabId)}>
            <X className="h-3! w-3!" />
            <span>Close</span>
          </MenuItem>
          {tabs.length > 1 && (
            <MenuItem value="close-others" onClick={() => onCloseOtherTabs?.(tab.tabId)}>
              <ArrowLeftRight className="h-3! w-3!" />
              <span>Close others</span>
            </MenuItem>
          )}
          {index > 0 && (
            <MenuItem value="close-left" onClick={() => onCloseTabsOnLeft?.(tab.tabId)}>
              <ArrowLeftFromLine className="h-3! w-3!" />
              <span>Close to the left</span>
            </MenuItem>
          )}
          {index < tabs.length - 1 && (
            <MenuItem value="close-right" onClick={() => onCloseTabsOnRight?.(tab.tabId)}>
              <ArrowRightFromLine className="h-3! w-3!" />
              <span>Close to the right</span>
            </MenuItem>
          )}
          <MenuItem value="close-all" onClick={() => onCloseAllTabs?.(tab.tabId)}>
            <CircleXIcon className="h-3! w-3!" />
            <span>Close all</span>
          </MenuItem>
          <div className="bg-border my-1 h-px" />
          <MenuItem value="duplicate" onClick={() => onDuplicateTab?.(tab.tabId)}>
            <CopyPlus className="h-3! w-3!" />
            <span>Duplicate</span>
          </MenuItem>
          <MenuItem value="copy-url" onClick={() => onCopyTabUrl?.(tab.tabId)}>
            <ClipboardIcon className="h-3! w-3!" />
            <span>Copy URL</span>
          </MenuItem>
        </MenuContent>
      </Portal>
    </Menu>
  );
};

export const TableTabsBar = (props: TableTabsBarProps) => {
  const {
    tabs,
    activeTabId,
    onTabChange,
    onTabClose,
    onAddTab,
    onTabHover,
    onDuplicateTab,
    onCloseTabsOnLeft,
    onCloseTabsOnRight,
    onCloseOtherTabs,
    onCloseAllTabs,
    onCopyTabUrl,
    onRenameTab,
    onToggleSidebar,
    isSidebarCollapsed,
    onTabsReorder,
  } = props;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !onTabsReorder) return;
    onTabsReorder(String(active.id), String(over.id));
  };

  const tabIds = tabs.map((tab) => tab.tabId);

  return (
    <div className="bg-muted/50 min-h-0 shrink-0 border-b">
      <Tabs.Root
        value={activeTabId || ""}
        onValueChange={(details) => {
          onTabChange(details.value);
        }}
        className="flex flex-col gap-0"
        loopFocus={false}
      >
        <div className="bg-muted/50 flex items-baseline gap-1 px-2 py-2">
          {onToggleSidebar && (
            <Tooltip content={isSidebarCollapsed ? "Show sidebar" : "Hide sidebar"}>
              <Button
                onClick={onToggleSidebar}
                variant="ghost"
                size="xs"
                className="relative top-[3px] shrink-0"
                aria-label={isSidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
                data-testid="toggle-sidebar"
                type="button"
              >
                <PanelLeft className="h-4 w-4" />
              </Button>
            </Tooltip>
          )}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToHorizontalAxis]}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={tabIds} strategy={horizontalListSortingStrategy}>
              <Tabs.List className="flex min-w-0 items-center gap-1 overflow-x-auto">
                {tabs.map((tab, index) => (
                  <TabItem
                    key={tab.tabId}
                    tab={tab}
                    index={index}
                    isActive={activeTabId === tab.tabId}
                    hasMultipleSchemas={props.hasMultipleSchemas}
                    onTabClose={onTabClose}
                    onTabHover={onTabHover}
                    onRenameTab={onRenameTab}
                    onDuplicateTab={onDuplicateTab}
                    onCloseOtherTabs={onCloseOtherTabs}
                    onCloseTabsOnLeft={onCloseTabsOnLeft}
                    onCloseTabsOnRight={onCloseTabsOnRight}
                    onCloseAllTabs={onCloseAllTabs}
                    onCopyTabUrl={onCopyTabUrl}
                    tabs={tabs}
                  />
                ))}
              </Tabs.List>
            </SortableContext>
          </DndContext>
          {onAddTab && (
            <Button
              onClick={onAddTab}
              variant="ghost"
              size="xs"
              className="relative top-[3px] shrink-0"
              aria-label="Add new tab"
              type="button"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>
      </Tabs.Root>
    </div>
  );
};
