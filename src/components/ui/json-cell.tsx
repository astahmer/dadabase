import { useState } from "react";
import { ChevronRightIcon } from "lucide-react";
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
					"h-6 text-xs px-2 w-full text-left justify-start gap-1.5",
					className,
				)}
				title={preview}
			>
				<ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground" />
				<span className="truncate w-full">{preview}</span>
			</Button>

			<Dialog open={open} onOpenChange={(details) => setOpen(details.open)}>
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
