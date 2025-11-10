import { Code, Copy, Eye } from "lucide-react";
import { MenuItem, MenuItemText } from "./menu";

export interface RowActionsMenuContentProps {
	row: Record<string, unknown>;
	onViewJson?: () => void;
	onClose?: () => void;
}

export function RowActionsMenuContent({
	row,
	onViewJson,
	onClose,
}: RowActionsMenuContentProps) {
	const handleLogRow = () => {
		console.log("Row data:", row);
		onClose?.();
	};

	const handleCopyRow = () => {
		const json = JSON.stringify(row, null, 2);
		navigator.clipboard.writeText(json).catch((err) => {
			console.error("Failed to copy:", err);
		});
		onClose?.();
	};

	return (
		<>
			{onViewJson && (
				<MenuItem value="view-json" onClick={onViewJson}>
					<Code className="size-4" />
					<MenuItemText>View JSON</MenuItemText>
				</MenuItem>
			)}
			<MenuItem value="log" onClick={handleLogRow}>
				<Eye className="size-4" />
				<MenuItemText>Log row to console</MenuItemText>
			</MenuItem>
			<MenuItem value="copy" onClick={handleCopyRow}>
				<Copy className="size-4" />
				<MenuItemText>Copy row as JSON</MenuItemText>
			</MenuItem>
		</>
	);
}
