import { Copy } from "lucide-react";
import { Button } from "./button";
import { Tooltip } from "./tooltip";

export function LogRowButton({ row }: { row: Record<string, unknown> }) {
	const handleLogRow = (e: React.MouseEvent) => {
		e.stopPropagation();
		console.log("Row data:", row);
	};

	const handleCopyRow = (e: React.MouseEvent) => {
		e.stopPropagation();
		const json = JSON.stringify(row, null, 2);
		navigator.clipboard.writeText(json).catch((err) => {
			console.error("Failed to copy:", err);
		});
	};

	return (
		<div className="flex gap-1">
			<Tooltip content="Log row to console">
				<Button
					variant="ghost"
					size="sm"
					onClick={handleLogRow}
					className="h-6 w-6 p-0"
				>
					<span className="text-xs font-bold">log</span>
				</Button>
			</Tooltip>
			<Tooltip content="Copy row as JSON">
				<Button
					variant="ghost"
					size="sm"
					onClick={handleCopyRow}
					className="h-6 w-6 p-0"
				>
					<Copy className="h-3 w-3" />
				</Button>
			</Tooltip>
		</div>
	);
}
