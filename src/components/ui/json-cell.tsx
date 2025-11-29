import { useState } from "react";
import { InlineJsonButton } from "../app/inline-json-button.tsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./dialog";
import { JsonViewerModal } from "./json-viewer";
import { Badge } from "./badge.tsx";

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

	if (value === null || value === undefined) {
		return (
			<Badge colorPalette="muted" size="2xs" variant="subtle">
				{value === null ? "NULL" : "undefined"}
			</Badge>
		);
	}

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
			<InlineJsonButton value={value} onOpenDialog={() => setOpen(true)}>
				<span className="truncate w-full group-data-cmd-hover:underline group-data-cmd-hover:underline-offset-2 group-data-cmd-hover:cursor-pointer">
					{preview}
				</span>
			</InlineJsonButton>

			<Dialog
				lazyMount
				open={open}
				onOpenChange={(details) => setOpen(details.open)}
			>
				<DialogContent size="6xl" className="h-[90vh] flex flex-col">
					<DialogHeader>
						<DialogTitle>JSON Data</DialogTitle>
					</DialogHeader>
					<div className="mt-4 flex-1 h-full min-h-0 overflow-y-auto">
						<JsonViewerModal data={value} />
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}
