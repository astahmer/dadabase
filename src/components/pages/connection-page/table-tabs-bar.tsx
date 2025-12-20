import { Portal } from "@ark-ui/react";
import { Editable, useEditable } from "@ark-ui/react/editable";
import { Tabs } from "@ark-ui/react/tabs";
import {
	ArrowLeftFromLine,
	ArrowLeftRight,
	ArrowRightFromLine,
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
	onCopyTabUrl?: (tabId: string) => void;
	onRenameTab?: (tabId: string, newName: string) => void;
	onToggleSidebar?: () => void;
	isSidebarCollapsed?: boolean;
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
	onCopyTabUrl?: (tabId: string) => void;
	tabs: readonly TableTab[];
}) => {
	const defaultName =
		tab.schema && tab.table
			? `${hasMultipleSchemas ? `${tab.schema}.` : ""}${tab.table}`
			: "New Tab";

	const displayName = tab.tabName || defaultName;
	const fkValueDisplay =
		tab.fkValue && tab.schema && tab.table ? ` [${tab.fkValue}]` : "";

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
					<div title={title}>
						<div className="flex items-center gap-1">
							<Editable.RootProvider value={editable}>
								<Editable.Preview className="truncate">
									{displayName}
								</Editable.Preview>
								<Editable.Input
									className="text-sm font-medium truncate outline-none border-0 bg-transparent p-0"
									onKeyDown={(e) => {
										// Stop propagation of arrow keys to prevent tab navigation
										if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
											e.stopPropagation();
										}
									}}
								/>
							</Editable.RootProvider>
							{fkValueDisplay && (
								<span className="text-xs italic text-muted-foreground truncate">
									{fkValueDisplay}
								</span>
							)}
						</div>
						<button
							className="rounded hover:bg-destructive/20 p-0.5 flex items-center justify-center hover:text-destructive"
							onClick={(e) => {
								e.stopPropagation();
								onTabClose(tab.tabId);
							}}
							aria-label="Close tab"
							type="button"
						>
							<X className="h-3! w-3!" />
						</button>
					</div>
				</Tabs.Trigger>
			</MenuContextTrigger>
			<Portal>
				<MenuContent className="w-48 z-10">
					<MenuItem value="rename" onClick={() => editable.edit()}>
						<Edit2 className="h-3! w-3!" />
						<span>Rename</span>
					</MenuItem>
					<div className="my-1 h-px bg-border" />
					<MenuItem value="close" onClick={() => onTabClose?.(tab.tabId)}>
						<X className="h-3! w-3!" />
						<span>Close</span>
					</MenuItem>
					{tabs.length > 1 && (
						<MenuItem
							value="close-others"
							onClick={() => onCloseOtherTabs?.(tab.tabId)}
						>
							<ArrowLeftRight className="h-3! w-3!" />
							<span>Close others</span>
						</MenuItem>
					)}
					{index > 0 && (
						<MenuItem
							value="close-left"
							onClick={() => onCloseTabsOnLeft?.(tab.tabId)}
						>
							<ArrowLeftFromLine className="h-3! w-3!" />
							<span>Close to the left</span>
						</MenuItem>
					)}
					{index < tabs.length - 1 && (
						<MenuItem
							value="close-right"
							onClick={() => onCloseTabsOnRight?.(tab.tabId)}
						>
							<ArrowRightFromLine className="h-3! w-3!" />
							<span>Close to the right</span>
						</MenuItem>
					)}
					<div className="my-1 h-px bg-border" />
					<MenuItem
						value="duplicate"
						onClick={() => onDuplicateTab?.(tab.tabId)}
					>
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
		onCopyTabUrl,
		onRenameTab,
		onToggleSidebar,
		isSidebarCollapsed,
	} = props;

	if (tabs.length === 0) {
		return null;
	}

	return (
		<div className="border-b bg-muted/50">
			<Tabs.Root
				value={activeTabId || ""}
				onValueChange={(details) => {
					onTabChange(details.value);
				}}
				className="flex flex-col gap-0"
				loopFocus={false}
			>
				<div className="flex items-baseline gap-1 px-2 py-2 bg-muted/50">
					{onToggleSidebar && (
						<Tooltip
							content={isSidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
						>
							<Button
								onClick={onToggleSidebar}
								variant="ghost"
								size="xs"
								className="shrink-0 relative top-[3px]"
								aria-label={
									isSidebarCollapsed ? "Show sidebar" : "Hide sidebar"
								}
								type="button"
							>
								<PanelLeft className="h-4 w-4" />
							</Button>
						</Tooltip>
					)}
					<Tabs.List className="flex items-center gap-1 overflow-x-auto min-w-0">
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
								onCopyTabUrl={onCopyTabUrl}
								tabs={tabs}
							/>
						))}
					</Tabs.List>
					{onAddTab && (
						<Button
							onClick={onAddTab}
							variant="ghost"
							size="xs"
							className="shrink-0 relative top-[3px]"
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
