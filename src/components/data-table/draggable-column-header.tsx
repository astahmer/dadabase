import type { Column } from "@tanstack/react-table";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { type CSSProperties, type JSX } from "react";

interface DraggableColumnHeaderProps<TData> {
  column: Column<TData>;
  children: (
    props: Pick<
      ReturnType<typeof useSortable>,
      "attributes" | "listeners" | "setNodeRef" | "transform" | "isDragging"
    > & { style: CSSProperties; isDragDisabled: boolean },
  ) => JSX.Element;
  className?: string;
}

export function DraggableColumnHeader<TData>({
  column,
  children,
}: DraggableColumnHeaderProps<TData>) {
  const isDragDisabled =
    (column.columnDef.meta as any)?.enableColumnOrdering === false || Boolean(column.getIsPinned());

  const sortable = useSortable({
    id: column.id,
    disabled: isDragDisabled,
  });
  if (isDragDisabled) return;

  const dragStyle: CSSProperties = {
    opacity: sortable.isDragging ? 0.5 : 1,
    position: "relative",
    transform: CSS.Translate.toString(sortable.transform), // translate instead of transform to avoid squishing
    transition: "width transform 0.2s ease-in-out",
    whiteSpace: "nowrap",
    width: column.getSize(),
    zIndex: sortable.isDragging ? 1 : 0,
  };

  return children({
    attributes: sortable.attributes,
    listeners: sortable.listeners,
    setNodeRef: sortable.setNodeRef,
    transform: sortable.transform,
    isDragging: sortable.isDragging,
    style: dragStyle,
    isDragDisabled,
  });
}
