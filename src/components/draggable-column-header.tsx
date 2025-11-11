import type { Column } from "@tanstack/react-table";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { ReactNode } from "react";
import { cn } from "../lib/utils";

interface DraggableColumnHeaderProps<TData> {
	column: Column<TData>;
	children: ReactNode;
	className?: string;
}

export function DraggableColumnHeader<TData>({
	column,
	children,
	className,
}: DraggableColumnHeaderProps<TData>) {
	const { attributes, listeners, setNodeRef, transform, isDragging } =
		useSortable({
			id: column.id,
		});

	const style = {
		transform: CSS.Transform.toString(transform),
		opacity: isDragging ? 0.5 : 1,
		transition: "opacity 0.2s",
	};

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={cn(
				"flex items-center gap-2 cursor-grab active:cursor-grabbing",
				className,
			)}
			{...attributes}
		>
			<button
				{...listeners}
				type="button"
				className="p-1 hover:bg-muted rounded cursor-grab active:cursor-grabbing"
				title="Drag to reorder columns"
			>
				<GripVertical className="size-4 text-muted-foreground" />
			</button>
			<div className="flex-1">{children}</div>
		</div>
	);
}
