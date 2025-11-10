import { Popover, Portal } from "@ark-ui/react";
import { useState } from "react";
import { RowJsonViewer } from "./row-json-viewer.tsx";
import { Menu, MenuContent, MenuContextTrigger } from "./ui/menu";
import { RowActionsMenuContent } from "./ui/row-actions-menu-content";

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
			lazyMount
			open={isJsonViewerOpen}
			onOpenChange={(details) => setIsJsonViewerOpen(details.open)}
		>
			<Menu lazyMount>
				<MenuContextTrigger asChild>{children}</MenuContextTrigger>
				<Portal>
					<Popover.Anchor>
						<MenuContent className="z-1" data-row-context-menu>
							<RowActionsMenuContent
								row={row}
								onViewJson={() => setIsJsonViewerOpen(true)}
							/>
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
