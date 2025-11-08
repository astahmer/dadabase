import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./dialog";
import { Button } from "./button";
import { JsonViewerModal } from "./json-viewer";
import { cn } from "../../lib/utils";

interface JsonCellProps {
	value: unknown;
	className?: string;
}

function generatePreview(value: unknown): string {
	try {
		const str = JSON.stringify(value);
		// Truncate to 60 characters and clean up
		if (str.length > 60) {
			return str.substring(0, 60).replace(/\s+/g, " ") + "…";
		}
		return str.replace(/\s+/g, " ");
	} catch {
		return String(value);
	}
}

export function JsonCell({ value, className }: JsonCellProps) {
	const [open, setOpen] = useState(false);

	// Determine if value is a complex object/array
	const isComplex =
		(typeof value === "object" && value !== null && !Array.isArray(value)) ||
		(Array.isArray(value) && value.length > 0);

	if (!isComplex) {
		// For simple values, just display them
		return <span className={className}>{String(value)}</span>;
	}

	// Generate a small preview of the JSON content
	const preview = generatePreview(value);

	return (
		<>
			<Button
				variant="ghost"
				size="sm"
				onClick={() => setOpen(true)}
				className={cn(
					"h-6 text-xs px-2 truncate max-w-32 text-left justify-start",
					className,
				)}
				title={preview}
			>
				{preview}
			</Button>

			<Dialog open={open} onOpenChange={(details) => setOpen(details.open)}>
				<DialogContent className="max-w-6xl h-[90vh] flex flex-col">
					<DialogHeader>
						<DialogTitle>JSON Data</DialogTitle>
					</DialogHeader>
					<div className="mt-4 flex-1 overflow-auto">
						<JsonViewerModal data={value} />
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}
