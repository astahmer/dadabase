import { Popover, Portal } from "@ark-ui/react";
import { Code, Copy, Eye } from "lucide-react";
import { useState } from "react";
import { RowJsonViewer } from "./row-json-viewer.tsx";
import {
	Menu,
	MenuContent,
	MenuContextTrigger,
	MenuItem,
	MenuItemText,
} from "./ui/menu";

export interface RowContextMenuProps {
	row: Record<string, unknown>;
	children: React.ReactNode;
	onViewJson?: () => void;
	onExpandRowJson?: (row: Record<string, unknown>) => void;
}

export function RowContextMenu({
	row,
	children,
	onExpandRowJson,
}: RowContextMenuProps) {
	const [isJsonViewerOpen, setIsJsonViewerOpen] = useState(false);

	return (
		<Popover.Root
			open={isJsonViewerOpen}
			onOpenChange={(details) => setIsJsonViewerOpen(details.open)}
		>
			<Menu lazyMount>
				<MenuContextTrigger asChild>{children}</MenuContextTrigger>
				<Portal>
					<Popover.Anchor>
						<MenuContent className="z-1" data-row-context-menu>
							<MenuItem
								value="view-json"
								onClick={() => {
									setIsJsonViewerOpen(true);
								}}
							>
								<Code className="size-4" />
								<MenuItemText>View JSON</MenuItemText>
							</MenuItem>
							<MenuItem
								value="log"
								onClick={() => {
									console.log("Row data:", row);
								}}
							>
								<Eye className="size-4" />
								<MenuItemText>Log row to console</MenuItemText>
							</MenuItem>
							<MenuItem
								value="copy"
								onClick={() => {
									const json = JSON.stringify(row, null, 2);
									navigator.clipboard.writeText(json).catch((err) => {
										console.error("Failed to copy:", err);
									});
								}}
							>
								<Copy className="size-4" />
								<MenuItemText>Copy row as JSON</MenuItemText>
							</MenuItem>
						</MenuContent>
					</Popover.Anchor>
				</Portal>
			</Menu>
			<Portal>
				<Popover.Positioner>
					<Popover.Content className="z-50">
						<RowJsonViewer
							row={row}
							onClose={() => setIsJsonViewerOpen(false)}
							onExpandToDialog={() => onExpandRowJson?.(row)}
						/>
					</Popover.Content>
				</Popover.Positioner>
			</Portal>
		</Popover.Root>
	);
}
