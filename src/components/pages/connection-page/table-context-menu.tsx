import { Portal } from "@ark-ui/react";
import { useNavigate } from "@tanstack/react-router";
import { ExternalLink, LayoutGrid } from "lucide-react";
import {
	Menu,
	MenuContent,
	MenuContextTrigger,
	MenuItem,
	MenuItemText,
	MenuSeparator,
} from "../../ui/menu.tsx";
import {
	addTabStateAfterCurrent,
	createTabState,
	scrollToTab,
	updateTabState,
} from "./create-tab-state.ts";

interface TableContextMenuProps {
	tableName: string;
	schema: string;
	children: React.ReactNode;
}

export const TableContextMenu = ({
	tableName,
	schema,
	children,
}: TableContextMenuProps) => {
	const navigate = useNavigate({ from: "/connections/$connectionName" });

	const handleOpenInNewTab = () => {
		const newTabState = createTabState(schema, tableName);
		navigate({
			search: (prev) => ({
				...prev,
				...addTabStateAfterCurrent(prev, newTabState),
			}),
		}).then(() => scrollToTab(newTabState.tabId));
	};

	const handleViewStructure = () => {
		const newTabState = createTabState(schema, tableName);
		navigate({
			search: (prev) => {
				return {
					...prev,
					...addTabStateAfterCurrent(prev, newTabState),
					activeTabId: newTabState.tabId,
					viewMode: "structure",
				};
			},
		}).then(() => scrollToTab(newTabState.tabId));
	};

	return (
		<Menu positioning={{ sameWidth: false }}>
			<MenuContextTrigger asChild>
				<div className="w-full">{children}</div>
			</MenuContextTrigger>
			<Portal>
				<MenuContent className="max-w-96 z-1">
					<MenuItem value="open-in-tab" onClick={handleOpenInNewTab}>
						<ExternalLink className="h-4 w-4" />
						<MenuItemText>Open in new tab</MenuItemText>
					</MenuItem>
					<MenuItem value="view-structure" onClick={handleViewStructure}>
						<LayoutGrid className="h-4 w-4" />
						<MenuItemText>View table structure</MenuItemText>
					</MenuItem>
					<MenuSeparator />
					<MenuItem
						value="table-name"
						disabled
						className="text-xs text-muted-foreground"
					>
						{schema}.{tableName}
					</MenuItem>
				</MenuContent>
			</Portal>
		</Menu>
	);
};
