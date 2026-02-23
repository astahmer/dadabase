import { JsonTreeView } from "@ark-ui/react";
import { useMutation } from "@tanstack/react-query";
import { Check, ChevronRightIcon, Copy, Play } from "lucide-react";
import { useState } from "react";
import { formatRelativeTime } from "#src/lib/format-relative-time.ts";
import {
	normalizeSql,
	replaceSqlParameters,
} from "#src/lib/replace-sql-parameters.ts";
import {
	executeAndStoreCustomSqlServerFn as executeAndStoreCustomSqlServerFn$1,
	type ExecuteAndStoreCustomSqlInput,
} from "#src/server/custom-sql/start-fns/execute-custom-sql.start.ts";
import type { QueryLogEntryType } from "#src/server/query-logger/query-logger.types.ts";
import { Badge } from "../ui/badge.tsx";
import { Button } from "../ui/button.tsx";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "../ui/dialog.tsx";
import { JsonViewer } from "../ui/json-viewer.tsx";
import { HStack, Stack } from "../ui/layout.tsx";
import { Spinner } from "../ui/spinner.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs.tsx";
import { Tooltip } from "../ui/tooltip.tsx";
import {
	QueryLogLevelBadge,
	QueryLogTypeBadge,
} from "./query-log-type-badge.tsx";

interface QueryLoggerDetailDialogProps {
	entry: QueryLogEntryType | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	connectionUrl?: string;
}

export const QueryLoggerDetailDialog = ({
	entry,
	open,
	onOpenChange,
	connectionUrl,
}: QueryLoggerDetailDialogProps) => {
	const [copied, setCopied] = useState(false);
	const [resultsData, setResultsData] = useState<any[]>([]);
	const [activeTab, setActiveTab] = useState("sql");

	const runQueryMutation = useMutation({
		mutationFn: async (input: ExecuteAndStoreCustomSqlInput) => {
			return executeAndStoreCustomSqlServerFn$1({ data: input });
		},
		onSuccess: (response) => {
			if (response && typeof response === "object" && "rows" in response) {
				setResultsData(Array.isArray(response.rows) ? response.rows : []);
			}
			setActiveTab("results");
		},
	});

	if (!entry) return null;

	const handleRunQuery = () => {
		if (!connectionUrl || !entry) return;

		const sql = replaceSqlParameters(entry.sql, entry.params) || entry.sql;

		runQueryMutation.mutate({
			url: connectionUrl,
			sql,
			schemaName: entry.schema,
			tableName: entry.table,
		});
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
			<DialogContent
				className="max-w-4xl h-[90vh] flex flex-col gap-0 p-0"
				size="4xl"
			>
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
					value={activeTab}
					onValueChange={(details) => setActiveTab(details.value)}
					className="flex-1 flex flex-col overflow-hidden"
				>
					<TabsList className="w-full rounded-none border-b px-6 py-0 bg-transparent h-auto justify-start">
						<TabsTrigger value="sql">SQL</TabsTrigger>
						<TabsTrigger value="metadata">Metadata</TabsTrigger>
						{resultsData.length > 0 && (
							<TabsTrigger value="results">
								Results ({resultsData.length})
							</TabsTrigger>
						)}
						{entry.error && <TabsTrigger value="error">Error</TabsTrigger>}
					</TabsList>

					<div className="flex-1 overflow-y-auto">
						<TabsContent value="sql" className="space-y-4 p-6 m-0">
							<div className="space-y-3">
								<div className="flex items-center justify-between">
									<h3 className="text-sm font-semibold">Query</h3>
									<HStack gap="2">
										{connectionUrl && (
											<Button
												size="sm"
												variant="outline"
												onClick={handleRunQuery}
												disabled={runQueryMutation.isPending}
												className="gap-2"
											>
												{runQueryMutation.isPending ? (
													<>
														<Spinner className="h-4 w-4" />
														Running...
													</>
												) : (
													<>
														<Play className="h-4 w-4" />
														Run Query
													</>
												)}
											</Button>
										)}
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
									</HStack>
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

						{resultsData.length > 0 && (
							<TabsContent value="results" className="space-y-4 p-6 m-0">
								<Stack gap="4" className="flex-1 min-h-0 flex flex-col">
									<div>
										<p className="text-xs font-medium text-muted-foreground mb-2">
											Results
										</p>
										<p className="text-sm font-semibold">
											{resultsData.length} row
											{resultsData.length !== 1 ? "s" : ""} returned
										</p>
									</div>

									{runQueryMutation.isError && (
										<div className="bg-destructive/10 p-3 rounded-lg">
											<p className="text-sm text-destructive">
												{runQueryMutation.error?.message ||
													"Error running query"}
											</p>
										</div>
									)}

									<div className="flex-1 min-h-0 overflow-auto border rounded-lg">
										<table className="w-full text-sm">
											<thead className="sticky top-0 bg-muted border-b">
												<tr>
													{resultsData.length > 0 &&
														Object.keys(resultsData[0]).map((key) => (
															<th
																key={key}
																className="px-3 py-2 text-left font-medium text-xs"
															>
																{key}
															</th>
														))}
												</tr>
											</thead>
											<tbody>
												{resultsData.map((row, idx) => (
													<tr
														key={idx}
														className="border-b hover:bg-muted/50 transition-colors"
													>
														{Object.values(row).map((value, colIdx) => (
															<td
																key={colIdx}
																className="px-3 py-2 text-xs font-mono text-muted-foreground"
															>
																{value === null ? (
																	<span className="text-muted-foreground italic">
																		null
																	</span>
																) : typeof value === "object" ? (
																	<span
																		className="text-muted-foreground cursor-help"
																		title={JSON.stringify(value, null, 2)}
																	>
																		{"{...}"}
																	</span>
																) : (
																	String(value)
																)}
															</td>
														))}
													</tr>
												))}
											</tbody>
										</table>
									</div>
								</Stack>
							</TabsContent>
						)}

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
