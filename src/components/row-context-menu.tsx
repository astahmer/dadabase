import { Copy } from "lucide-react";
import {
	Menu,
	MenuContextTrigger,
	MenuContent,
	MenuItem,
	MenuItemText,
} from "./ui/menu";

export interface RowContextMenuProps {
	row: Record<string, unknown>;
	children: React.ReactNode;
}

export function RowContextMenu({ row, children }: RowContextMenuProps) {
	const handleLogRow = () => {
		console.log("Row data:", row);
	};

	const handleCopyRow = () => {
		const json = JSON.stringify(row, null, 2);
		navigator.clipboard.writeText(json).catch((err) => {
			console.error("Failed to copy:", err);
		});
	};

	return (
		<Menu>
			<MenuContextTrigger asChild>{children}</MenuContextTrigger>
			<MenuContent className="z-1">
				<MenuItem value="log" onClick={handleLogRow}>
					<MenuItemText>Log row to console</MenuItemText>
				</MenuItem>
				<MenuItem value="copy" onClick={handleCopyRow}>
					<Copy className="size-4" />
					<MenuItemText>Copy row as JSON</MenuItemText>
				</MenuItem>
			</MenuContent>
		</Menu>
	);
}
