import { Portal } from "@ark-ui/react";
import { Tabs } from "@ark-ui/react/tabs";
import {
	ArrowLeftFromLine,
	ArrowLeftRight,
	ArrowRightFromLine,
	ClipboardIcon,
	CopyPlus,
	Plus,
	X,
} from "lucide-react";
import { Button } from "../../ui/button";
import { Menu, MenuContent, MenuContextTrigger, MenuItem } from "../../ui/menu";

export interface TableTab {
	tabId: string; // Explicit unique identifier
	schema: string;
	table: string;
	fkValue?: string; // Optional FK value used when navigating to this tab
}

interface TableTabsBarProps {
	tabs: Array<TableTab> | ReadonlyArray<TableTab>;
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
}

export const TableTabsBar = ({
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
}: TableTabsBarProps) => {
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
			>
				<div className="flex items-baseline gap-1 px-2 py-2 bg-muted/50">
					<Tabs.List className="flex items-center gap-1 overflow-x-auto min-w-0">
						{tabs.map((tab, index) => (
							<Menu key={tab.tabId}>
								<MenuContextTrigger asChild>
									<Tabs.Trigger
										value={tab.tabId}
										className={`flex items-center gap-2 px-3 py-1.5 rounded-t-md border border-b-0 cursor-pointer transition-all whitespace-nowrap text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${
											activeTabId === tab.tabId
												? "bg-background text-foreground border-input"
												: "bg-muted text-muted-foreground border-muted hover:bg-background/50 hover:text-foreground"
										}`}
										onMouseEnter={() => onTabHover?.(tab)}
										asChild
										data-table-tab={tab.tabId}
										data-table-tab-active={
											activeTabId === tab.tabId ? true : undefined
										}
									>
										<div
											title={
												tab.schema && tab.table
													? `${tab.schema}.${tab.table}${tab.fkValue ? ` [${tab.fkValue}]` : ""}`
													: undefined
											}
										>
											<span className="truncate">
												{tab.schema && tab.table ? (
													<span className="flex items-center gap-1">
														<span>{`${tab.schema}.${tab.table}`}</span>
														{tab.fkValue && (
															<span className="text-xs italic text-muted-foreground truncate">
																[{tab.fkValue}]
															</span>
														)}
													</span>
												) : (
													"New Tab"
												)}
											</span>
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
										<MenuItem
											value="close"
											onClick={() => onTabClose?.(tab.tabId)}
										>
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
										<MenuItem
											value="copy-url"
											onClick={() => onCopyTabUrl?.(tab.tabId)}
										>
											<ClipboardIcon className="h-3! w-3!" />
											<span>Copy URL</span>
										</MenuItem>
									</MenuContent>
								</Portal>
							</Menu>
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
