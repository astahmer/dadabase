import {
	LucideMoreHorizontal,
	MoreHorizontal,
	MoreHorizontalIcon,
} from "lucide-react";
import { useState } from "react";
import { Button } from "./button";
import { Menu, MenuTrigger, MenuContent, MenuItem, MenuItemText } from "./menu";
import { Portal } from "@ark-ui/react";

export interface RowActionsMenuProps {
	row: Record<string, unknown>;
}

export function RowActionsMenu({ row }: RowActionsMenuProps) {
	const [open, setOpen] = useState(false);

	const handleLogRow = () => {
		console.log("Row data:", row);
		setOpen(false);
	};

	const handleCopyRow = () => {
		const json = JSON.stringify(row, null, 2);
		navigator.clipboard.writeText(json).catch((err) => {
			console.error("Failed to copy:", err);
		});
		setOpen(false);
	};

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
					<MenuItem value="log" onClick={handleLogRow}>
						<MenuItemText>Log row to console</MenuItemText>
					</MenuItem>
					<MenuItem value="copy" onClick={handleCopyRow}>
						<MenuItemText>Copy row as JSON</MenuItemText>
					</MenuItem>
				</MenuContent>
			</Portal>
		</Menu>
	);
}
