import { Code, X, Copy } from "lucide-react";
import { JsonViewerModal } from "./ui/json-viewer";
import { Stack } from "./ui/layout.tsx";
import { useState, useCallback } from "react";

interface RowJsonViewerProps {
	row: Record<string, unknown>;
	onExpandToDialog?: () => void;
	onClose?: () => void;
}

export function RowJsonViewer({
	row,
	onExpandToDialog,
	onClose,
}: RowJsonViewerProps) {
	const [copied, setCopied] = useState(false);

	const handleCopy = useCallback(() => {
		navigator.clipboard.writeText(JSON.stringify(row, null, 2));
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	}, [row]);

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

	const preview = generatePreview(row);

	return (
		<div className="min-w-96 max-w-2xl bg-background border border-border rounded-lg shadow-lg overflow-hidden">
			{/* Header */}
			<div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center justify-between gap-2">
				<div className="flex items-center gap-2 min-w-0">
					<Code className="h-3 w-3 text-muted-foreground shrink-0" />
					<span className="text-xs font-semibold text-muted-foreground">
						Row Data
					</span>
				</div>
				<div className="flex items-center gap-1">
					<button
						onClick={handleCopy}
						className="p-1 hover:bg-muted/70 rounded transition-colors text-muted-foreground text-xs"
						title={copied ? "Copied!" : "Copy row JSON"}
					>
						<Copy className="h-3.5 w-3.5" />
					</button>
					{onClose && (
						<button
							onClick={onClose}
							className="p-1 hover:bg-muted/70 rounded transition-colors text-muted-foreground"
							aria-label="Close"
						>
							<X className="h-3.5 w-3.5" />
						</button>
					)}
				</div>
			</div>

			{/* Subheader with preview */}
			<div className="px-3 py-1.5 text-xs text-muted-foreground truncate font-mono border-b border-border/50">
				{preview}
			</div>

			{/* Content */}
			<Stack className="max-h-72 w-full overflow-y-auto p-3">
				<div className="text-sm">
					<JsonViewerModal data={row} />
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
