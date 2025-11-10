import { cn } from "#src/lib/utils";
import { ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface CollapsibleSidebarProps {
	children: React.ReactNode;
	isOpen?: boolean;
	onOpenChange?: (isOpen: boolean) => void;
	className?: string;
}

const MIN_WIDTH = 224;
const MAX_WIDTH = 400;

export const CollapsibleSidebar = ({
	children,
	isOpen: controlledIsOpen,
	onOpenChange,
	className,
}: CollapsibleSidebarProps) => {
	const [internalIsOpen, setInternalIsOpen] = useState(true);
	const [width, setWidth] = useState(224);
	const [isResizing, setIsResizing] = useState(false);
	const sidebarRef = useRef<HTMLDivElement>(null);

	const isOpen = controlledIsOpen ?? internalIsOpen;
	const setIsOpen = (value: boolean) => {
		setInternalIsOpen(value);
		onOpenChange?.(value);
	};

	const toggleSidebar = () => {
		setIsOpen(!isOpen);
	};

	useEffect(() => {
		if (!isResizing) return;

		const handleMouseMove = (e: MouseEvent) => {
			if (!sidebarRef.current) return;

			const sidebarRect = sidebarRef.current.getBoundingClientRect();
			const newWidth = e.clientX - sidebarRect.left;
			const clampedWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, newWidth));
			setWidth(clampedWidth);
		};

		const handleMouseUp = () => {
			setIsResizing(false);
		};

		document.addEventListener("mousemove", handleMouseMove);
		document.addEventListener("mouseup", handleMouseUp);

		return () => {
			document.removeEventListener("mousemove", handleMouseMove);
			document.removeEventListener("mouseup", handleMouseUp);
		};
	}, [isResizing]);

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
		<div className="relative h-full shrink-0 select-none" ref={sidebarRef}>
			{/* Sidebar content - relatively positioned */}
			<div
				style={{ width: `${width}px` }}
				className="bg-muted/30 border-r h-full flex flex-col overflow-hidden z-20 transition-[width] duration-75"
			>
				{children}
			</div>

			{/* Close button & resize handle - absolutely positioned on right edge */}
			<div
				className={cn(
					"absolute top-0 bottom-0 right-0 translate-x-1/2 w-8 h-full bg-card/50 z-30 group",
					isResizing
						? "cursor-grabbing"
						: "cursor-col-resize hover:bg-muted/50",
				)}
				onMouseDown={() => setIsResizing(true)}
				onDoubleClick={toggleSidebar}
				title="Drag to resize, double-click to close"
			>
				<div className="w-px h-full m-auto group-hover:bg-foreground/30 transition-colors" />
			</div>
		</div>
	);
};
