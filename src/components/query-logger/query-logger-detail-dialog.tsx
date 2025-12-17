import { JsonTreeView } from "@ark-ui/react";
import { Check, ChevronRightIcon, Copy } from "lucide-react";
import { useState } from "react";
import { formatRelativeTime } from "#src/lib/format-relative-time.ts";
import {
	normalizeSql,
	replaceSqlParameters,
} from "#src/lib/replace-sql-parameters.ts";
import type { QueryLogEntryType } from "#src/server/query-logger/query-logger.types.ts";
import { Badge } from "../ui/badge.tsx";
import { Button } from "../ui/button.tsx";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "../ui/dialog.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs.tsx";
import { Tooltip } from "../ui/tooltip.tsx";
import {
	QueryLogLevelBadge,
	QueryLogTypeBadge,
} from "./query-log-type-badge.tsx";
import { JsonViewer } from "../ui/json-viewer.tsx";

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

	if (!entry) return null;

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

	const relativeTime = formatRelativeTime(entry.startTime.getTime());
	const exactTime = new Date(entry.startTime).toLocaleTimeString();

	const handleCopy = (text: string) => {
		navigator.clipboard.writeText(text);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	// Convert array params to mapped object with $1, $2, etc. as keys
	const getMappedParams = ():
		| Record<string, any>
		| ReadonlyArray<any>
		| null => {
		if (!entry.params) return null;
		if (Array.isArray(entry.params)) {
			const mapped: Record<string, any> = {};
			for (let i = 0; i < entry.params.length; i++) {
				mapped[`$${i + 1}`] = entry.params[i];
			}
			return mapped;
		}
		return entry.params;
	};

	return (
		<Dialog open={open} onOpenChange={(details) => onOpenChange(details.open)}>
			<DialogContent className="max-w-4xl h-[90vh] flex flex-col gap-0 p-0">
				<DialogHeader className="border-b px-6 py-4 shrink-0">
					<DialogTitle className="flex items-center gap-2">
						Query Details
						<Badge
							colorPalette={statusColorMap[entry.status]}
							size="xs"
							className="capitalize"
						>
							{entry.status}
						</Badge>
					</DialogTitle>
				</DialogHeader>

				<Tabs
					defaultValue="sql"
					className="flex-1 flex flex-col overflow-hidden"
				>
					<TabsList className="w-full rounded-none border-b px-6 py-0 bg-transparent h-auto justify-start">
						<TabsTrigger value="sql">SQL</TabsTrigger>
						<TabsTrigger value="metadata">Metadata</TabsTrigger>
						{entry.error && <TabsTrigger value="error">Error</TabsTrigger>}
					</TabsList>

					<div className="flex-1 overflow-y-auto">
						<TabsContent value="sql" className="space-y-4 p-6 m-0">
							<div className="space-y-3">
								<div className="flex items-center justify-between">
									<h3 className="text-sm font-semibold">Query</h3>
									<Button
										size="sm"
										variant="outline"
										onClick={() => handleCopy(entry.sql)}
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
								<pre className="bg-muted p-3 rounded-lg overflow-x-auto text-xs font-mono wrap-break-word whitespace-pre-wrap leading-relaxed">
									<code>{normalizeSql(entry.sql)}</code>
								</pre>
							</div>

							{entry.params && (
								<div className="space-y-3">
									<h3 className="text-sm font-semibold mb-3">Parameters</h3>
									<pre className="bg-muted p-3 rounded-lg overflow-x-auto text-xs font-mono">
										<code>{JSON.stringify(getMappedParams(), null, 2)}</code>
									</pre>

									<div className="flex items-center justify-between">
										<h3 className="text-sm font-semibold">
											Raw SQL (inlined parameters)
										</h3>
										<Button
											size="sm"
											variant="outline"
											onClick={() =>
												handleCopy(
													replaceSqlParameters(entry.sql, entry.params),
												)
											}
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
									<pre className="bg-muted p-3 rounded-lg overflow-x-auto text-xs font-mono wrap-break-word whitespace-pre-wrap leading-relaxed">
										<code>
											{normalizeSql(
												replaceSqlParameters(entry.sql, entry.params),
											)}
										</code>
									</pre>
								</div>
							)}
						</TabsContent>

						<TabsContent value="metadata" className="space-y-4 p-6 m-0">
							<div className="grid grid-cols-2 gap-4">
								<div>
									<p className="text-xs font-medium text-muted-foreground mb-1">
										Type
									</p>
									<QueryLogTypeBadge type={entry.type} size="sm" />
								</div>
								<div>
									<p className="text-xs font-medium text-muted-foreground mb-1">
										Level
									</p>
									<QueryLogLevelBadge level={entry.level} size="sm" />
								</div>
								{entry.schema && (
									<div>
										<p className="text-xs font-medium text-muted-foreground mb-1">
											Schema
										</p>
										<p className="text-sm">{entry.schema}</p>
									</div>
								)}
								{entry.table && (
									<div>
										<p className="text-xs font-medium text-muted-foreground mb-1">
											Table
										</p>
										<p className="text-sm">{entry.table}</p>
									</div>
								)}
								{entry.timeTaken !== undefined && (
									<div>
										<p className="text-xs font-medium text-muted-foreground mb-1">
											Duration
										</p>
										<p className="text-sm">{entry.timeTaken}ms</p>
									</div>
								)}
								{entry.rowsReturned !== undefined && (
									<div>
										<p className="text-xs font-medium text-muted-foreground mb-1">
											Rows Returned
										</p>
										<p className="text-sm">{entry.rowsReturned}</p>
									</div>
								)}
								{entry.rowsAffected !== undefined && (
									<div>
										<p className="text-xs font-medium text-muted-foreground mb-1">
											Rows Affected
										</p>
										<p className="text-sm">{entry.rowsAffected}</p>
									</div>
								)}
								{entry.startTime && (
									<div>
										<p className="text-xs font-medium text-muted-foreground mb-1">
											Executed At
										</p>
										<Tooltip
											content={exactTime}
											portalled
											showArrow={false}
											openDelay={300}
											closeDelay={0}
										>
											<p className="text-sm cursor-help">{relativeTime}</p>
										</Tooltip>
									</div>
								)}
							</div>
							{entry.meta && (
								// <JsonTreeView.Root
								// 	data={entry.meta}
								// 	defaultExpandedDepth={5}
								// 	className="h-full"
								// >
								// 	<JsonTreeView.Tree arrow={<ChevronRightIcon />} />
								// </JsonTreeView.Root>
								<JsonViewer
									data={entry.meta}
									defaultExpanded
									className="h-full"
								/>
							)}
						</TabsContent>

						{entry.error && (
							<TabsContent value="error" className="space-y-4 p-6 m-0">
								<div>
									<p className="text-sm font-semibold mb-2">Error Message</p>
									<pre className="bg-destructive/10 p-3 rounded-lg overflow-x-auto text-xs font-mono text-destructive wrap-break-word whitespace-pre-wrap">
										<code>{entry.error.message}</code>
									</pre>
								</div>
								{entry.error.stack && (
									<div>
										<p className="text-sm font-semibold mb-2">Stack Trace</p>
										<pre className="bg-muted p-3 rounded-lg overflow-x-auto text-xs font-mono wrap-break-word whitespace-pre-wrap">
											<code>{entry.error.stack}</code>
										</pre>
									</div>
								)}
							</TabsContent>
						)}
					</div>
				</Tabs>
			</DialogContent>
		</Dialog>
	);
};
