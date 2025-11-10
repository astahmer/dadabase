import { LucideMoreHorizontal } from "lucide-react";
import { useState } from "react";
import { Button } from "./button";
import { Menu, MenuTrigger, MenuContent } from "./menu";
import { Portal } from "@ark-ui/react";
import { RowActionsMenuContent } from "./row-actions-menu-content";

export interface RowActionsMenuProps {
	row: Record<string, unknown>;
	onViewJson?: () => void;
}

export function RowActionsMenu({ row, onViewJson }: RowActionsMenuProps) {
	const [open, setOpen] = useState(false);

	return (
		<Menu
			open={open}
			onOpenChange={(details) => setOpen(details.open)}
			lazyMount
		>
			<MenuTrigger asChild>
				<Button variant="ghost" size="xs">
					<LucideMoreHorizontal />
				</Button>
			</MenuTrigger>
			<Portal>
				<MenuContent className="z-50">
					<RowActionsMenuContent
						row={row}
						onClose={() => setOpen(false)}
						onViewJson={onViewJson}
					/>
				</MenuContent>
			</Portal>
		</Menu>
	);
}
