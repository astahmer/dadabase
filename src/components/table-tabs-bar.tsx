import { X, Plus } from "lucide-react";
import { Tabs } from "@ark-ui/react/tabs";
import { Button } from "./ui/button";

export interface TableTab {
	tabId: string; // Explicit unique identifier
	schema: string;
	table: string;
	fkValue?: string; // Optional FK value used when navigating to this tab
}

interface TableTabsBarProps {
	tabs: TableTab[];
	activeTabId: string | null;
	onTabChange: (tabId: string) => void;
	onTabClose: (tabId: string) => void;
	onAddTab?: () => void;
	onTabHover?: (tab: TableTab) => void;
}

export const TableTabsBar = ({
	tabs,
	activeTabId,
	onTabChange,
	onTabClose,
	onAddTab,
	onTabHover,
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
				<div className="flex items-baseline justify-between gap-1 px-2 py-2 bg-muted/50">
					<Tabs.List className="flex items-center gap-1 overflow-x-auto">
						{tabs.map((tab) => (
							<Tabs.Trigger
								key={tab.tabId}
								value={tab.tabId}
								className={`flex items-center gap-2 px-3 py-1.5 rounded-t-md border border-b-0 cursor-pointer transition-all whitespace-nowrap text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${
									activeTabId === tab.tabId
										? "bg-background text-foreground border-input"
										: "bg-muted text-muted-foreground border-muted hover:bg-muted/80"
								}`}
								onMouseEnter={() => onTabHover?.(tab)}
								asChild
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
										<X className="h-3 w-3" />
									</button>
								</div>
							</Tabs.Trigger>
						))}
					</Tabs.List>
					{onAddTab && (
						<Button
							onClick={onAddTab}
							variant="outline"
							size="sm"
							className="ml-4 shrink-0"
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
