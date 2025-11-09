import { Code } from "lucide-react";
import { JsonViewerModal } from "./ui/json-viewer";
import { Stack } from "./ui/layout.tsx";

interface InlineJsonPopoverProps {
	value: unknown;
	onExpandToDialog?: () => void;
}

export function InlineJsonPopover({
	value,
	onExpandToDialog,
}: InlineJsonPopoverProps) {
	function generatePreview(val: unknown): string {
		try {
			const str = JSON.stringify(val);
			if (str.length > 100) {
				return str.substring(0, 100).replace(/\s+/g, " ") + "…";
			}
			return str.replace(/\s+/g, " ");
		} catch {
			return String(val);
		}
	}

	const preview = generatePreview(value);

	return (
		<div className="min-w-96 max-w-2xl bg-background border border-border rounded-lg shadow-lg overflow-hidden">
			{/* Header */}
			<div className="px-3 py-2 border-b border-border bg-muted/30">
				<div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
					<Code className="h-3 w-3" />
					<span>JSON Data</span>
				</div>
				<div className="text-xs text-muted-foreground mt-1 truncate font-mono">
					{preview}
				</div>
			</div>

			{/* Content */}
			<Stack className="max-h-72 w-full overflow-y-auto p-3">
				<div className="text-sm">
					<JsonViewerModal data={value} />
				</div>
			</Stack>

			{/* Footer */}
			{onExpandToDialog && (
				<div className="border-t border-border px-3 py-2 bg-muted/20">
					<button
						onClick={onExpandToDialog}
						className="w-full text-xs text-center py-1.5 hover:bg-muted/70 rounded transition-colors font-medium text-foreground"
					>
						Expand JSON viewer →
					</button>
				</div>
			)}
		</div>
	);
}
