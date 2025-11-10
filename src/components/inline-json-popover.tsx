import { Code, X, Copy, Check } from "lucide-react";
import { Clipboard, useClipboard } from "@ark-ui/react";
import { JsonViewerModal } from "./ui/json-viewer";
import { Stack } from "./ui/layout.tsx";

interface InlineJsonPopoverProps {
	value: unknown;
	onExpandToDialog?: () => void;
	onClose?: () => void;
}

export function InlineJsonPopover({
	value,
	onExpandToDialog,
	onClose,
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
	const clipboard = useClipboard();

	return (
		<div className="min-w-96 max-w-2xl bg-background border border-border rounded-lg shadow-lg overflow-hidden">
			{/* Header */}
			<div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center justify-between gap-2">
				<div className="flex items-center gap-2 min-w-0">
					<Code className="h-3 w-3 text-muted-foreground shrink-0" />
					<span className="text-xs font-semibold text-muted-foreground">
						JSON Data
					</span>
				</div>
				<div className="flex items-center gap-1">
					<Clipboard.RootProvider value={clipboard}>
						<button
							className="p-1 hover:bg-muted/70 rounded transition-colors text-muted-foreground text-xs"
							title="Copy JSON"
							onMouseEnter={() => {
								clipboard.setValue(JSON.stringify(value, null, 2));
							}}
							onClick={() => {
								clipboard.copy();
							}}
						>
							<Clipboard.Indicator copied={<Check className="h-3 w-3" />}>
								<Copy className="h-3.5 w-3.5" />
							</Clipboard.Indicator>
						</button>
					</Clipboard.RootProvider>
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
