import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "../ui/dialog.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs.tsx";
import { Button } from "../ui/button.tsx";
import { Badge } from "../ui/badge.tsx";
import { Copy, Check } from "lucide-react";
import { useState } from "react";
import type { QueryLogEntryType } from "#src/server/query-logger/query-logger.types.ts";
import { formatRelativeTime } from "#src/lib/format-relative-time.ts";

interface QueryLoggerDetailDialogProps {
	entry: QueryLogEntryType | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export const QueryLoggerDetailDialog = ({
	entry,
	open,
	onOpenChange,
}: QueryLoggerDetailDialogProps) => {
	const [copied, setCopied] = useState(false);

	const handleCopy = () => {
		if (entry?.sql) {
			navigator.clipboard.writeText(entry.sql);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		}
	};

	if (!entry) return null;

	const queryTypeColorMap: Record<
		string,
		| "default"
		| "secondary"
		| "destructive"
		| "success"
		| "error"
		| "warning"
		| "info"
		| "muted"
	> = {
		table: "info",
		schema: "secondary",
		enum: "warning",
		constraint: "destructive",
		total: "muted",
		columns: "default",
	};

	const statusColorMap: Record<
		string,
		| "default"
		| "secondary"
		| "destructive"
		| "success"
		| "error"
		| "warning"
		| "info"
		| "muted"
	> = {
		success: "success",
		error: "error",
		pending: "warning",
	};

	const relativeTime = formatRelativeTime(entry.startTime);
	const exactTime = new Date(entry.startTime).toLocaleTimeString();

	return (
		<Dialog open={open} onOpenChange={(details) => onOpenChange(details.open)}>
			<DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						Query Details
						<Badge colorPalette={statusColorMap[entry.status]} size="xs">
							{entry.status}
						</Badge>
					</DialogTitle>
				</DialogHeader>

				<Tabs defaultValue="sql" className="w-full">
					<TabsList>
						<TabsTrigger value="sql">SQL</TabsTrigger>
						<TabsTrigger value="metadata">Metadata</TabsTrigger>
						{entry.error && <TabsTrigger value="error">Error</TabsTrigger>}
					</TabsList>

					<TabsContent value="sql" className="space-y-3">
						<div className="flex items-center justify-between">
							<h3 className="font-semibold">Query</h3>
							<Button
								size="sm"
								variant="outline"
								onClick={handleCopy}
								className="gap-2"
							>
								{copied ? (
									<>
										<Check className="h-4 w-4" />
										Copied
									</>
								) : (
									<>
										<Copy className="h-4 w-4" />
										Copy
									</>
								)}
							</Button>
						</div>
						<pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm font-mono">
							<code>{entry.sql}</code>
						</pre>
					</TabsContent>

					<TabsContent value="metadata" className="space-y-4">
						<div className="grid grid-cols-2 gap-4">
							<div>
								<p className="text-sm font-medium text-muted-foreground">
									Type
								</p>
								<Badge
									colorPalette={queryTypeColorMap[entry.type]}
									size="sm"
									className="w-fit"
								>
									{entry.type}
								</Badge>
							</div>
							{entry.schema && (
								<div>
									<p className="text-sm font-medium text-muted-foreground">
										Schema
									</p>
									<p className="text-sm">{entry.schema}</p>
								</div>
							)}
							{entry.table && (
								<div>
									<p className="text-sm font-medium text-muted-foreground">
										Table
									</p>
									<p className="text-sm">{entry.table}</p>
								</div>
							)}
							{entry.timeTaken !== undefined && (
								<div>
									<p className="text-sm font-medium text-muted-foreground">
										Duration
									</p>
									<p className="text-sm">{entry.timeTaken}ms</p>
								</div>
							)}
							{entry.rowsReturned !== undefined && (
								<div>
									<p className="text-sm font-medium text-muted-foreground">
										Rows Returned
									</p>
									<p className="text-sm">{entry.rowsReturned}</p>
								</div>
							)}
							{entry.rowsAffected !== undefined && (
								<div>
									<p className="text-sm font-medium text-muted-foreground">
										Rows Affected
									</p>
									<p className="text-sm">{entry.rowsAffected}</p>
								</div>
							)}
							{entry.startTime && (
								<div>
									<p className="text-sm font-medium text-muted-foreground">
										Executed At
									</p>
									<p className="text-sm" title={exactTime}>
										{relativeTime}
									</p>
								</div>
							)}
						</div>

						{entry.params && (
							<div>
								<p className="text-sm font-medium text-muted-foreground mb-2">
									Parameters
								</p>
								<pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm font-mono">
									<code>
										{typeof entry.params === "string"
											? entry.params
											: JSON.stringify(entry.params, null, 2)}
									</code>
								</pre>
							</div>
						)}
					</TabsContent>

					{entry.error && (
						<TabsContent value="error" className="space-y-3">
							<div>
								<p className="text-sm font-medium text-muted-foreground mb-2">
									Error Message
								</p>
								<pre className="bg-destructive/10 p-4 rounded-lg overflow-x-auto text-sm font-mono text-destructive">
									<code>{entry.error.message}</code>
								</pre>
							</div>
							{entry.error.stack && (
								<div>
									<p className="text-sm font-medium text-muted-foreground mb-2">
										Stack Trace
									</p>
									<pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs font-mono">
										<code>{entry.error.stack}</code>
									</pre>
								</div>
							)}
						</TabsContent>
					)}
				</Tabs>
			</DialogContent>
		</Dialog>
	);
};
