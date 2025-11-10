import { Copy, Code } from "lucide-react";
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
	onViewJson?: () => void;
}

export function RowContextMenu({
	row,
	children,
	onViewJson,
}: RowContextMenuProps) {
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
		<Menu lazyMount>
			<MenuContextTrigger asChild>{children}</MenuContextTrigger>
			<MenuContent className="z-1">
				{onViewJson && (
					<MenuItem value="view-json" onClick={onViewJson}>
						<Code className="size-4" />
						<MenuItemText>View JSON</MenuItemText>
					</MenuItem>
				)}
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
