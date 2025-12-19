import { Check, Copy, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "#src/components/ui/button.tsx";
import { cn } from "#src/lib/utils.ts";

interface SqlQueryPreviewProps {
	/** The raw SQL query string */
	sql: string;
	/** Formatted SQL with indentation (for display) */
	formattedSql?: string;
	/** Whether the query is loading */
	isLoading?: boolean;
	/** Any error that occurred while generating the SQL */
	error?: Error | null;
	/** Optional callback when user clicks to edit (prepare for Monaco integration) */
	onEditClick?: () => void;
	/** Whether the preview is collapsed */
	isCollapsed?: boolean;
	/** Callback to toggle collapsed state */
	onToggleCollapsed?: (collapsed: boolean) => void;
	/** Custom CSS class */
	className?: string;
}

/**
 * Component that displays a generated SQL query in read-only format
 * Includes copy-to-clipboard functionality and space for future Monaco editor integration
 *
 * Structure prepared for future Monaco editor:
 * - Read-only mode: displays query with copy button
 * - Edit mode (future): Monaco editor will replace the display area
 * - Tabs: "Preview" (read-only) + "Edit" (Monaco) when implemented
 */
export function SqlQueryPreview({
	sql,
	formattedSql,
	isLoading = false,
	error = null,
	onEditClick,
	isCollapsed = true,
	onToggleCollapsed,
	className,
}: SqlQueryPreviewProps) {
	const [copied, setCopied] = useState(false);

	const displaySql = formattedSql || sql;

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(sql);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch (err) {
			console.error("Failed to copy SQL to clipboard:", err);
		}
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
			{/* Header with toggle and copy button */}
			<div className="relative flex items-center justify-between border-b border-gray-200 px-4 py-2">
				<button
					onClick={() => onToggleCollapsed?.(!isCollapsed)}
					className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-gray-900 cursor-pointer flex-1"
				>
					{isCollapsed ? (
						<ChevronRight className="h-4 w-4" />
					) : (
						<ChevronDown className="h-4 w-4" />
					)}
					SQL Query
				</button>
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

			{/* SQL Display Area - collapsed by default */}
			{!isCollapsed && (
				<div className="overflow-x-auto bg-gray-50 px-4 py-3">
					<pre className="font-mono text-sm text-gray-800 whitespace-pre-wrap break-words">
						{displaySql}
					</pre>
				</div>
			)}

			{/* Placeholder for future Monaco editor integration */}
			{/* When implemented:
			 * - Conditional rendering based on edit mode
			 * - Monaco editor component wrapped in this area
			 * - Real-time SQL validation and formatting
			 * - Syntax highlighting and autocompletion
			 */}
		</div>
	);
}

/**
 * Minimal version for compact display (e.g., in tabs)
 */
export function SqlQueryPreviewCompact({
	sql,
	onClick,
	className,
}: {
	sql: string;
	onClick?: () => void;
	className?: string;
}) {
	return (
		<button
			onClick={onClick}
			className={cn(
				"max-w-full overflow-hidden text-ellipsis whitespace-nowrap rounded bg-gray-100 px-2 py-1 font-mono text-xs text-gray-700 hover:bg-gray-200",
				className,
			)}
			title={sql}
		>
			{sql}
		</button>
	);
}
