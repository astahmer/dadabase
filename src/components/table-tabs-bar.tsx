import { X } from "lucide-react";
import { Tabs } from "@ark-ui/react/tabs";

export interface TableTab {
	id: string; // "schema.table"
	schema: string;
	table: string;
}

interface TableTabsBarProps {
	tabs: TableTab[];
	activeTabId: string | null;
	onTabChange: (tabId: string) => void;
	onTabClose: (tabId: string) => void;
}

export const TableTabsBar = ({
	tabs,
	activeTabId,
	onTabChange,
	onTabClose,
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
				<Tabs.List className="flex items-center gap-1 px-2 py-2 overflow-x-auto bg-muted/50">
					{tabs.map((tab) => (
						<Tabs.Trigger
							key={tab.id}
							value={tab.id}
							className={`flex items-center gap-2 px-3 py-1.5 rounded-t-md border border-b-0 cursor-pointer transition-all whitespace-nowrap text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 ${
								activeTabId === tab.id
									? "bg-background text-foreground border-input"
									: "bg-muted text-muted-foreground border-muted hover:bg-muted/80"
							}`}
						>
							<span className="truncate">
								{tab.schema}.{tab.table}
							</span>
							<button
								className="rounded hover:bg-destructive/20 p-0.5 flex items-center justify-center hover:text-destructive"
								onClick={(e) => {
									e.stopPropagation();
									onTabClose(tab.id);
								}}
								aria-label="Close tab"
								type="button"
							>
								<X className="h-3 w-3" />
							</button>
						</Tabs.Trigger>
					))}
				</Tabs.List>
			</Tabs.Root>
		</div>
	);
};
