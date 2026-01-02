import { Button } from "#src/components/ui/button.tsx";
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "#src/components/ui/hovercard.tsx";
import { Tooltip } from "#src/components/ui/tooltip.tsx";
import { cn } from "#src/lib/utils.ts";
import type { TableWithColumnsMetadata } from "#src/server/introspection/introspection.ts";
import { Portal } from "@ark-ui/react";
import { Tabs } from "@ark-ui/react/tabs";
import {
	Check,
	ChevronDown,
	ChevronRight,
	Copy,
	Maximize2,
	Play,
	RotateCcw,
	Wand2,
	Zap,
} from "lucide-react";
import { useEffectEvent, useRef, useState } from "react";
import { SqlMonacoEditor } from "./sql-monaco-editor.tsx";

interface SqlQueryPreviewProps {
	/** The raw SQL query string */
	sql: string;
	/** Formatted SQL with indentation (for display) */
	formattedSql?: string;
	/** Whether the query is loading */
	isLoading?: boolean;
	/** Any error that occurred while generating the SQL */
	error?: Error | null;
	/** Current editor mode: "preview" or "editor" */
	editorMode?: "preview" | "editor";
	/** Callback when editor mode changes */
	onEditorModeChange?: (mode: "preview" | "editor") => void;
	/** Callback when editor content changes */
	onEditorChange?: (value: string) => void;
	/** Custom SQL that user has edited (if different from generated SQL) */
	customSql?: string;
	/** Callback to reset custom SQL */
	onResetCustomSql?: () => void;
	/** Callback to run the query */
	onRun?: () => void;
	/** Callback to explain the query */
	onExplain?: () => void;
	/** Whether to disable the explain button */
	disableExplain?: boolean;
	/** Callback to format the SQL */
	onFormat?: () => void;
	/** Callback to toggle fullscreen editor */
	onToggleFullscreen?: () => void;
	/** Whether editor is in fullscreen mode */
	isFullscreen?: boolean;
	/** Whether the preview is collapsed */
	isCollapsed?: boolean;
	/** Callback to toggle collapsed state */
	onToggleCollapsed?: (collapsed: boolean) => void;
	/** Available tables for intellisense suggestions */
	tables?: Array<{ schema: string; name: string }>;
	/** Available columns grouped by table */
	columns?: TableWithColumnsMetadata[];
	/** Custom CSS class */
	className?: string;
}

/**
 * Component that displays a generated SQL query with both preview and editor modes
 * Preview mode: read-only formatted SQL display
 * Editor mode: Monaco SQL editor for manual editing
 *
 * - Preview is the default
 * - Editor mode is opt-in via tabs
 * - Custom mode: when user edits SQL, UI controls are disabled
 * - Both modes preserve the collapsed/expanded state
 */
export function SqlQueryPreview({
	sql,
	isLoading = false,
	error = null,
	editorMode = "preview",
	onEditorModeChange,
	onEditorChange,
	customSql,
	onResetCustomSql,
	onRun,
	onExplain,
	disableExplain = false,
	onFormat,
	onToggleFullscreen,
	isFullscreen = false,
	isCollapsed = true,
	onToggleCollapsed,
	tables = [],
	columns = [],
	className,
}: SqlQueryPreviewProps) {
	const [copied, setCopied] = useState(false);
	const editorValueRef = useRef<string>(sql);
	// console.log({ sql, customSql });

	const handleCopy = async () => {
		try {
			const textToCopy = editorMode === "editor" ? editorValueRef.current : sql;
			await navigator.clipboard.writeText(textToCopy);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch (err) {
			console.error("Failed to copy SQL to clipboard:", err);
		}
	};

	const handleEditorChange = useEffectEvent((value: string) => {
		editorValueRef.current = value;
		onEditorChange?.(value);
	});

	if (isLoading) {
		return (
			<div
				className={cn(
					"rounded border border-gray-200 bg-gray-50 p-4",
					className,
				)}
			>
				<div className="text-sm text-gray-500">Generating SQL query...</div>
			</div>
		);
	}

	if (error) {
		return (
			<div
				className={cn("rounded border border-red-200 bg-red-50 p-4", className)}
			>
				<div className="text-sm font-medium text-red-900">
					Error generating SQL:
				</div>
				<div className="mt-1 text-sm text-red-800">
					{error.message || "Unknown error"}
				</div>
			</div>
		);
	}

	if (!sql) {
		return (
			<div
				className={cn(
					"rounded border border-gray-200 bg-gray-50 p-4",
					className,
				)}
			>
				<div className="text-sm text-gray-500">No SQL query generated</div>
			</div>
		);
	}

	return (
		<div
			className={cn(
				"flex flex-col rounded border border-gray-200 h-full",
				isFullscreen &&
					"fixed inset-0 z-50 rounded-none border-0 bg-background",
				className,
			)}
		>
			{/* Header with toggle, tabs, warning, and actions */}
			<div className="border-b border-gray-200 px-4">
				{/* Top row: toggle + tabs + actions + copy */}
				<div className="flex items-center justify-between gap-4 my-1">
					<div className="flex items-center gap-4 flex-1">
						<Portal
							container={
								typeof window === "undefined"
									? undefined
									: {
											current: document.querySelector(
												"#connection-page-filters-top-row",
											),
										}
							}
						>
							<HoverCard>
								<HoverCardTrigger asChild>
									<Button
										size="sm"
										variant={customSql ? "default" : "ghost"}
										onClick={() => onToggleCollapsed?.(!isCollapsed)}
										className="flex items-center gap-2 text-xs self-center"
									>
										{isCollapsed ? (
											<ChevronRight className="h-4 w-4" />
										) : (
											<ChevronDown className="h-4 w-4" />
										)}
										SQL Query
									</Button>
								</HoverCardTrigger>
								{isCollapsed && (
									<HoverCardContent className="max-w-md">
										<pre className="font-mono text-xs text-foreground whitespace-pre-wrap overflow-x-auto max-h-64">
											{sql}
										</pre>
									</HoverCardContent>
								)}
							</HoverCard>
						</Portal>

						{/* Editor mode tabs */}
						<Tabs.Root
							value={editorMode || "preview"}
							onValueChange={(details) => {
								onEditorModeChange?.(details.value as "preview" | "editor");
							}}
						>
							<Tabs.List className="flex gap-1">
								<Tabs.Trigger
									value="preview"
									className={cn(
										"px-3 py-1 text-xs font-medium transition-colors data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:border-b-2 data-[state=active]:border-blue-500 hover:bg-gray-100",
										editorMode !== "preview" &&
											"text-gray-600 hover:text-gray-900",
									)}
								>
									Preview
								</Tabs.Trigger>
								<Tabs.Trigger
									value="editor"
									className={cn(
										"px-3 py-1 text-xs font-medium transition-colors data-[state=active]:bg-white data-[state=active]:text-gray-900 data-[state=active]:border-b-2 data-[state=active]:border-blue-500 hover:bg-gray-100",
										editorMode !== "editor" &&
											"text-gray-600 hover:text-gray-900",
									)}
								>
									Editor
								</Tabs.Trigger>

								{/* Custom query warning - inline below tabs */}
								{customSql && (
									<div className="ml-auto flex items-center justify-between gap-3 -mx-4 px-4 py-2">
										<p className="text-xs font-medium text-amber-900">
											📝 Editing raw SQL — filters and other controls are
											disabled
										</p>
										<Button
											variant="ghost"
											size="sm"
											onClick={onResetCustomSql}
											title="Reset to generated query and restore UI controls"
											className="h-6 px-2 text-xs gap-1 shrink-0"
										>
											<RotateCcw className="h-3 w-3" />
											Reset
										</Button>
									</div>
								)}
							</Tabs.List>
						</Tabs.Root>
					</div>

					{/* Action buttons - shown in editor mode */}
					{editorMode === "editor" && !isCollapsed && (
						<div className="flex items-center gap-2">
							<Tooltip content="Run query">
								<Button
									variant="ghost"
									size="sm"
									onClick={onRun}
									className="h-8 px-2"
								>
									<Play className="h-4 w-4" />
								</Button>
							</Tooltip>
							<Tooltip content="Explain query">
								<Button
									variant="ghost"
									size="sm"
									onClick={onExplain}
									disabled={disableExplain}
									className="h-8 px-2"
								>
									<Zap className="h-4 w-4" />
								</Button>
							</Tooltip>
							<Tooltip content="Format SQL">
								<Button
									variant="ghost"
									size="sm"
									onClick={onFormat}
									className="h-8 px-2"
								>
									<Wand2 className="h-4 w-4" />
								</Button>
							</Tooltip>
							<Tooltip content="Toggle fullscreen">
								<Button
									variant="ghost"
									size="sm"
									onClick={onToggleFullscreen}
									className="h-8 px-2"
								>
									<Maximize2 className="h-4 w-4" />
								</Button>
							</Tooltip>
						</div>
					)}

					<Tooltip content="Copy SQL to clipboard">
						<Button
							variant="ghost"
							size="sm"
							onClick={handleCopy}
							className="h-8 px-2 shrink-0"
						>
							{copied ? (
								<Check className="h-4 w-4 text-green-600" />
							) : (
								<Copy className="h-4 w-4" />
							)}
						</Button>
					</Tooltip>
				</div>
			</div>
			{/* Content - collapsed by default */}
			{!isCollapsed && (
				<>
					{editorMode === "preview" ? (
						<div className="overflow-x-auto bg-gray-50 px-4 py-3">
							<pre className="font-mono text-sm text-gray-800 whitespace-pre-wrap wrap-break-word">
								{sql}
							</pre>
						</div>
					) : (
						<div className="bg-gray-50 border-t border-gray-200 h-full">
							<SqlMonacoEditor
								sql={customSql || sql}
								onChange={handleEditorChange}
								onSubmit={onRun}
								className="w-full h-full"
								tables={tables}
								columns={columns}
							/>
						</div>
					)}
				</>
			)}
		</div>
	);
}
