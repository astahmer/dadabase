import { createListCollection } from "@ark-ui/react";
import { cx } from "class-variance-authority";
import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { useState } from "react";
import { useQueryLogger } from "#src/components/query-logger/use-query-logger.ts";
import {
	type QueryLogEntryType,
	QueryLogLevel,
	type QueryLogStatus,
	QueryLogType,
} from "#src/server/query-logger/query-logger.types.ts";
import { Button, buttonVariants } from "../ui/button.tsx";
import { HStack } from "../ui/layout.tsx";
import * as Select from "../ui/select.tsx";
import { VirtualizerArea } from "../ui/virtualizer-area.tsx";
import { QueryLogEntry } from "./query-log-entry.tsx";
import { QueryLoggerDetailDialog } from "./query-logger-detail-dialog.tsx";

interface QueryLoggerContentProps {
	connectionUrl: string;
	isExpanded?: boolean;
	onCollapse?: () => void;
	onExpand?: () => void;
}

export const QueryLoggerContent = ({
	connectionUrl,
	isExpanded,
	onCollapse,
	onExpand,
}: QueryLoggerContentProps) => {
	const queryLogger = useQueryLogger({ connectionUrl });
	const [selectedEntry, setSelectedEntry] = useState<QueryLogEntryType | null>(
		null,
	);
	const [dialogOpen, setDialogOpen] = useState(false);

	const handleExpand = (entry: QueryLogEntryType) => {
		setSelectedEntry(entry);
		setDialogOpen(true);
	};

	const toggleStatusFilter = (status: QueryLogStatus) => {
		queryLogger.setFilters({
			...queryLogger.filters,
			status: queryLogger.filters?.status === status ? undefined : status,
		});
	};

	const isSuccessFiltered =
		queryLogger.filters?.status &&
		(Array.isArray(queryLogger.filters.status)
			? queryLogger.filters.status.includes("success")
			: queryLogger.filters.status === "success");

	const isPendingFiltered =
		queryLogger.filters?.status &&
		(Array.isArray(queryLogger.filters.status)
			? queryLogger.filters.status.includes("pending")
			: queryLogger.filters.status === "pending");

	const isErrorFiltered =
		queryLogger.filters?.status &&
		(Array.isArray(queryLogger.filters.status)
			? queryLogger.filters.status.includes("error")
			: queryLogger.filters.status === "error");

	return (
		<>
			<div className="flex items-center px-4 py-2 border-b bg-muted/50 h-12 shrink-0 hover:bg-muted transition-colors group">
				<div className="flex items-center gap-2 font-medium">
					<span>Query Logger</span>
					{isExpanded !== undefined && (onCollapse || onExpand) && (
						<button
							className="ml-2 p-1 rounded hover:bg-primary/20 transition-colors opacity-60 hover:opacity-100"
							title={isExpanded ? "Collapse" : "Expand"}
							onClick={(e) => {
								e.stopPropagation();
								if (isExpanded) {
									onCollapse?.();
								} else {
									onExpand?.();
								}
							}}
						>
							{isExpanded ? (
								<ChevronDown className="h-4 w-4" />
							) : (
								<ChevronUp className="h-4 w-4" />
							)}
						</button>
					)}
				</div>
				<HStack className="ml-2 gap-1 mr-auto">
					<div
						onClick={() => {
							toggleStatusFilter("success");
							if (!isExpanded) {
								onExpand?.();
							}
						}}
						title="Filter by success"
						className={cx(
							buttonVariants({ size: "sm", variant: "ghost" }),
							"transition-all rounded-md px-2 py-1.5 flex items-center gap-1.5",
							isSuccessFiltered
								? "bg-green-500/20 text-green-700 hover:bg-green-500/30"
								: "text-muted-foreground hover:text-foreground hover:bg-green-200/50",
						)}
					>
						<div className="h-2.5 w-2.5 rounded-full bg-green-500" />
						<span className="text-xs font-medium">
							{queryLogger.counts.success}
						</span>
					</div>
					<div
						onClick={() => {
							toggleStatusFilter("pending");
							if (!isExpanded) {
								onExpand?.();
							}
						}}
						title="Filter by pending"
						className={cx(
							buttonVariants({ size: "sm", variant: "ghost" }),
							"transition-all rounded-md px-2 py-1.5 flex items-center gap-1.5",
							isPendingFiltered
								? "bg-amber-500/20 text-amber-700 hover:bg-amber-500/30"
								: "text-muted-foreground hover:text-foreground hover:bg-amber-200/50",
						)}
					>
						<div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
						<span className="text-xs font-medium">
							{queryLogger.counts.pending}
						</span>
					</div>
					<div
						onClick={() => {
							toggleStatusFilter("error");
							if (!isExpanded) {
								onExpand?.();
							}
						}}
						title="Filter by error"
						className={cx(
							buttonVariants({ size: "sm", variant: "ghost" }),
							"transition-all rounded-md px-2 py-1.5 flex items-center gap-1.5",
							isErrorFiltered
								? "bg-red-500/20 text-red-700 hover:bg-red-500/30"
								: "text-muted-foreground hover:text-foreground hover:bg-red-200/50",
						)}
					>
						<div className="h-2.5 w-2.5 rounded-full bg-red-500" />
						<span className="text-xs font-medium">
							{queryLogger.counts.error}
						</span>
					</div>
				</HStack>
				<HStack align="center">
					<Select.SelectRoot
						className="w-full min-w-64"
						collection={logTypeCollection}
						positioning={{ sameWidth: true }}
						multiple
						defaultValue={
							queryLogger.filters?.type
								? Array.isArray(queryLogger.filters.type)
									? (queryLogger.filters.type as any[])
									: ([queryLogger.filters.type] as any[])
								: undefined
						}
						onValueChange={(details) => {
							queryLogger.setFilters((prev) => ({
								...prev,
								type: details.value as any[],
							}));
						}}
					>
						<Select.SelectControl size="sm">
							<Select.SelectTrigger>
								<Select.SelectValueText placeholder="Type: All" />
								<Select.SelectIndicator />
							</Select.SelectTrigger>
						</Select.SelectControl>
						<Select.SelectContent>
							{logTypeCollection.items.map((item) => (
								<Select.SelectItem key={item.value} item={item}>
									{item.label}
								</Select.SelectItem>
							))}
						</Select.SelectContent>
					</Select.SelectRoot>
					<Select.SelectRoot
						className="w-full min-w-48"
						collection={logLevelCollection}
						positioning={{ sameWidth: true }}
						multiple
						defaultValue={
							queryLogger.filters?.level
								? Array.isArray(queryLogger.filters.level)
									? (queryLogger.filters.level as any[])
									: ([queryLogger.filters.level] as any[])
								: undefined
						}
						onValueChange={(details) => {
							queryLogger.setFilters((prev) => ({
								...prev,
								level: details.value as any[],
							}));
						}}
					>
						<Select.SelectControl size="sm">
							<Select.SelectTrigger>
								<Select.SelectValueText placeholder="Log level: All" />
								<Select.SelectIndicator />
							</Select.SelectTrigger>
						</Select.SelectControl>
						<Select.SelectContent>
							{logLevelCollection.items.map((item) => (
								<Select.SelectItem key={item.value} item={item}>
									{item.label}
								</Select.SelectItem>
							))}
						</Select.SelectContent>
					</Select.SelectRoot>
					<Button
						size="sm"
						variant="ghost"
						onClick={() => {
							queryLogger.clearHistory();
						}}
						disabled={queryLogger.isClearing}
						title="Clear history"
						className="text-muted-foreground hover:text-foreground"
					>
						<Trash2 className="h-4 w-4" />
					</Button>
				</HStack>
			</div>

			<div className="flex flex-col flex-1 min-h-0 h-full">
				{queryLogger.history.length === 0 ? (
					<div className="flex items-center justify-center h-52 text-muted-foreground">
						No queries executed yet
					</div>
				) : (
					<div className="divide-y flex flex-col flex-1 min-h-0 h-full">
						<VirtualizerArea
							count={queryLogger.history.length}
							virtualizerOptions={{ estimateSize: () => 50 }}
						>
							{({ virtualItems, totalSize, paddingTop, paddingBottom }) => (
								<>
									<div
										style={{ height: `${totalSize}px` }}
										className="relative"
									>
										{/* Padding for virtualizer */}
										{paddingTop > 0 && (
											<div style={{ height: `${paddingTop}px` }} />
										)}

										{[...virtualItems].reverse().map((virtualItem) => {
											const entry = queryLogger.history[virtualItem.index];
											if (!entry) return null;

											return (
												<QueryLogEntry
													key={entry.id}
													entry={entry}
													onExpand={handleExpand}
												/>
											);
										})}

										{/* Padding for virtualizer */}
										{paddingBottom > 0 && (
											<div style={{ height: `${paddingBottom}px` }} />
										)}
									</div>
								</>
							)}
						</VirtualizerArea>
					</div>
				)}
			</div>

			<QueryLoggerDetailDialog
				entry={selectedEntry}
				open={dialogOpen}
				onOpenChange={setDialogOpen}
			/>
		</>
	);
};

const logTypeCollection = createListCollection({
	items: Object.entries(QueryLogType)
		.filter(([key]) => isNaN(Number(key)))
		.map(([label, value]) => ({
			label: label,
			value: value as QueryLogType,
		})),
});

const logLevelCollection = createListCollection({
	items: Object.entries(QueryLogLevel)
		.filter(([key]) => isNaN(Number(key)))
		.map(([label, value]) => ({
			label: label,
			value: value as QueryLogLevel,
		})),
});
