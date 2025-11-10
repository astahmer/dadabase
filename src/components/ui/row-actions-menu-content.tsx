import { Code, Copy, Eye } from "lucide-react";
import { Clipboard, useClipboard } from "@ark-ui/react";
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

	const clipboard = useClipboard();

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
			<Clipboard.RootProvider value={clipboard}>
				<MenuItem value="copy" asChild>
					<Clipboard.Trigger
						onMouseEnter={() => {
							clipboard.setValue(JSON.stringify(row, null, 2));
						}}
						onClick={() => {
							clipboard.copy();
							onClose?.();
						}}
					>
						<Copy className="size-4" />
						<MenuItemText>Copy row as JSON</MenuItemText>
					</Clipboard.Trigger>
				</MenuItem>
			</Clipboard.RootProvider>
		</>
	);
}
