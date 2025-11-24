import { Code, X, Copy } from "lucide-react";
import { Clipboard, useClipboard } from "@ark-ui/react";
import { JsonViewerModal } from "../ui/json-viewer.tsx";
import { Stack } from "../ui/layout.tsx";
import { RelationshipExplorer } from "#src/components/pages/connection-page/relationships/relationship-explorer.tsx";

interface RowJsonViewerProps {
	row: Record<string, unknown>;
	onExpandToDialog?: () => void;
	onClose?: () => void;
	/** Optional: Enable relationship explorer mode */
	showRelationships?: boolean;
	/** Optional: Current schema for relationship queries */
	schema?: string;
	/** Optional: Current table for relationship queries */
	table?: string;
	/** Optional: Connection URL for relationship queries */
	connectionUrl?: string;
}

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

export function RowJsonViewer({
	row,
	onExpandToDialog,
	onClose,
	showRelationships = false,
	schema,
	table,
	connectionUrl,
}: RowJsonViewerProps) {
	const preview = generatePreview(row);
	const clipboard = useClipboard();

	// Use relationship explorer if requested and we have required data
	const useRelationshipExplorer =
		showRelationships && schema && table && connectionUrl;

	return (
		<div className="min-w-96 max-w-2xl bg-background border border-border rounded-lg shadow-lg overflow-hidden">
			{/* Header */}
			<div className="px-3 py-2 border-b border-border bg-muted/30 flex items-center justify-between gap-2">
				<div className="flex items-center gap-2 min-w-0">
					<Code className="h-3 w-3 text-muted-foreground shrink-0" />
					<span className="text-xs font-semibold text-muted-foreground">
						{useRelationshipExplorer ? "Row with Relations" : "Row Data"}
					</span>
				</div>
				<div className="flex items-center gap-1">
					<Clipboard.RootProvider value={clipboard}>
						<Clipboard.Trigger asChild>
							<button
								className="p-1 hover:bg-muted/70 rounded transition-colors text-muted-foreground text-xs"
								title="Copy row JSON"
								onMouseEnter={() => {
									clipboard.setValue(JSON.stringify(row, null, 2));
								}}
								onClick={() => {
									clipboard.copy();
								}}
							>
								<Copy className="h-3.5 w-3.5" />
							</button>
						</Clipboard.Trigger>
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
					{useRelationshipExplorer ? (
						<div className="flex flex-col gap-3 min-h-0 h-full">
							<div className="bg-muted p-3 rounded border border-border overflow-auto min-h-0 h-full">
								<RelationshipExplorer
									row={row}
									schema={schema}
									table={table}
									connectionUrl={connectionUrl}
									maxDepth={3}
									showRelationships={true}
								/>
							</div>
						</div>
					) : (
						<JsonViewerModal data={row} />
					)}
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
