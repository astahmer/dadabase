import { useState, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "#src/lib/utils";

interface CollapsibleSidebarProps {
	children: React.ReactNode;
	isOpen?: boolean;
	onOpenChange?: (isOpen: boolean) => void;
	className?: string;
}

export const CollapsibleSidebar = ({
	children,
	isOpen: controlledIsOpen,
	onOpenChange,
	className,
}: CollapsibleSidebarProps) => {
	const [internalIsOpen, setInternalIsOpen] = useState(true);
	const isOpen = controlledIsOpen ?? internalIsOpen;
	const setIsOpen = (value: boolean) => {
		setInternalIsOpen(value);
		onOpenChange?.(value);
	};

	const toggleSidebar = () => {
		setIsOpen(!isOpen);
	};

	if (!isOpen) {
		// Closed state: 40px wide on the left
		return (
			<div
				className={cn(
					"w-10 border-r bg-card/50 flex items-center justify-center flex-col gap-2 cursor-pointer hover:bg-muted/50 transition-colors h-full shrink-0",
					className,
				)}
				onClick={toggleSidebar}
				title="Open sidebar"
			>
				<ChevronRight className="h-4 w-4 text-muted-foreground" />
			</div>
		);
	}

	// Open state: visible on left with close button on right edge
	return (
		<div className="relative h-full shrink-0">
			{/* Sidebar content - relatively positioned */}
			<div className="w-56 bg-muted/30 border-r h-full flex flex-col overflow-hidden z-20">
				{children}
			</div>

			{/* Close button - absolutely positioned on right edge */}
			<div
				className="absolute top-0 bottom-0 right-0 translate-x-1/2 w-10 h-full bg-card/50 cursor-w-resize z-30 group"
				onClick={toggleSidebar}
				title="Close sidebar"
			>
				<div className="w-px h-full m-auto group-hover:bg-foreground/30 transition-colors" />
			</div>
		</div>
	);
};
