import { Check, Copy, ChevronDown, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "#src/components/ui/button.tsx";
import { cn } from "#src/lib/utils.ts";
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
	/** Whether the preview is collapsed */
	isCollapsed?: boolean;
	/** Callback to toggle collapsed state */
	onToggleCollapsed?: (collapsed: boolean) => void;
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
 * - Both modes preserve the collapsed/expanded state
 */
export function SqlQueryPreview({
	sql,
	formattedSql,
	isLoading = false,
	error = null,
	editorMode = "preview",
	onEditorModeChange,
	onEditorChange,
	isCollapsed = true,
	onToggleCollapsed,
	className,
}: SqlQueryPreviewProps) {
	const [copied, setCopied] = useState(false);
	const editorValueRef = useRef<string>(sql);

	const displaySql = formattedSql || sql;

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

	const handleEditorChange = (value: string) => {
		editorValueRef.current = value;
		onEditorChange?.(value);
	};

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
			className={cn("flex flex-col rounded border border-gray-200", className)}
		>
			{/* Header with toggle, tabs, and copy button */}
			<div className="relative flex items-center justify-between border-b border-gray-200 px-4 py-2">
				<div className="flex items-center gap-4 flex-1">
					<button
						onClick={() => onToggleCollapsed?.(!isCollapsed)}
						className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-gray-900 cursor-pointer"
					>
						{isCollapsed ? (
							<ChevronRight className="h-4 w-4" />
						) : (
							<ChevronDown className="h-4 w-4" />
						)}
						SQL Query
					</button>

					{/* Editor mode tabs */}
					<div className="flex gap-1 border-l border-gray-300 pl-4">
						<button
							onClick={() => onEditorModeChange?.("preview")}
							className={cn(
								"px-3 py-1 text-xs font-medium rounded-t transition-colors",
								editorMode === "preview"
									? "bg-white text-gray-900 border-b-2 border-blue-500"
									: "text-gray-600 hover:text-gray-900",
							)}
						>
							Preview
						</button>
						<button
							onClick={() => onEditorModeChange?.("editor")}
							className={cn(
								"px-3 py-1 text-xs font-medium rounded-t transition-colors",
								editorMode === "editor"
									? "bg-white text-gray-900 border-b-2 border-blue-500"
									: "text-gray-600 hover:text-gray-900",
							)}
						>
							Editor
						</button>
					</div>
				</div>

				<Button
					variant="ghost"
					size="sm"
					onClick={handleCopy}
					title="Copy SQL to clipboard"
					className="h-8 px-2 absolute right-2"
				>
					{copied ? (
						<Check className="h-4 w-4 text-green-600" />
					) : (
						<Copy className="h-4 w-4" />
					)}
				</Button>
			</div>

			{/* Content - collapsed by default */}
			{!isCollapsed && (
				<>
					{editorMode === "preview" ? (
						<div className="overflow-x-auto bg-gray-50 px-4 py-3">
							<pre className="font-mono text-sm text-gray-800 whitespace-pre-wrap break-words">
								{displaySql}
							</pre>
						</div>
					) : (
						<div className="h-64 bg-gray-50 border-t border-gray-200">
							<SqlMonacoEditor
								sql={sql}
								onChange={handleEditorChange}
								className="w-full h-full"
							/>
						</div>
					)}
				</>
			)}
		</div>
	);
}
