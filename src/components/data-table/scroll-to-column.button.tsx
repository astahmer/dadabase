import { createListCollection } from "@ark-ui/react/listbox";
import { useFilter } from "@ark-ui/react/locale";
import type { Table as TanstackTable } from "@tanstack/react-table";
import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import * as ListboxMenu from "../ui/listbox-menu";

interface ScrollToColumnButtonProps {
	table: TanstackTable<any>;
	containerRef: React.RefObject<HTMLDivElement | null>;
}

export function ScrollToColumnButton(props: ScrollToColumnButtonProps) {
	const { table, containerRef } = props;

	const [isOpen, setIsOpen] = useState(false);
	const [isOverflowing, setIsOverflowing] = useState(false);
	const [filterValue, setFilterValue] = useState("");

	const { contains } = useFilter({ sensitivity: "base" });

	// Check if columns overflow the container
	useEffect(() => {
		const checkOverflow = () => {
			if (!containerRef.current) return;

			const scrollWidth = containerRef.current.scrollWidth;
			const clientWidth = containerRef.current.clientWidth;
			setIsOverflowing(scrollWidth > clientWidth);
		};

		checkOverflow();
		const resizeObserver = new ResizeObserver(checkOverflow);
		if (containerRef.current) {
			resizeObserver.observe(containerRef.current);
		}

		window.addEventListener("resize", checkOverflow);

		return () => {
			resizeObserver.disconnect();
			window.removeEventListener("resize", checkOverflow);
		};
	}, [containerRef]);

	const visibleNonPinnedColumnIds = table
		.getVisibleLeafColumns()
		.filter((c) => !c.getIsPinned())
		.map((c) => c.id);

	const columnCollection = createListCollection({
		items: visibleNonPinnedColumnIds.map((colId) => ({
			label: colId,
			value: colId,
		})),
	});
	const filteredColumns = visibleNonPinnedColumnIds.filter((colId) =>
		contains(colId, filterValue),
	);

	const handleColumnSelect = (columnName: string) => {
		const container = containerRef.current;
		if (!container) return;

		const allLeafColumnsInOrder = table.getVisibleLeafColumns();
		const targetIndex = allLeafColumnsInOrder.findIndex(
			(c) => c.id === columnName,
		);
		if (targetIndex === -1) return;

		const leftPinnedWidth = allLeafColumnsInOrder
			.filter((c) => c.getIsPinned() === "left")
			.reduce((acc, c) => acc + c.getSize(), 0);
		const rightPinnedWidth = allLeafColumnsInOrder
			.filter((c) => c.getIsPinned() === "right")
			.reduce((acc, c) => acc + c.getSize(), 0);

		const targetStart = allLeafColumnsInOrder
			.slice(0, targetIndex)
			.reduce((acc, c) => acc + c.getSize(), 0);
		const targetSize = allLeafColumnsInOrder[targetIndex]?.getSize() ?? 0;
		const targetEnd = targetStart + targetSize;

		const currentScrollLeft = container.scrollLeft;
		const viewportStart = currentScrollLeft + leftPinnedWidth;
		const viewportEnd =
			currentScrollLeft + container.clientWidth - rightPinnedWidth;

		let nextScrollLeft = currentScrollLeft;
		if (targetStart < viewportStart) {
			nextScrollLeft = targetStart - leftPinnedWidth;
		} else if (targetEnd > viewportEnd) {
			nextScrollLeft = targetEnd - (container.clientWidth - rightPinnedWidth);
		}

		const maxScrollLeft = Math.max(
			0,
			container.scrollWidth - container.clientWidth,
		);
		nextScrollLeft = Math.min(maxScrollLeft, Math.max(0, nextScrollLeft));

		container.scrollTo({ left: nextScrollLeft, behavior: "auto" });
	};

	if (!isOverflowing) {
		return null;
	}

	return (
		<ListboxMenu.ListboxMenuRoot
			open={isOpen}
			onOpenChange={(e) => setIsOpen(e.open)}
		>
			<ListboxMenu.ListboxMenuTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					className="absolute right-2 top-12 -translate-y-1/2 z-10 h-9 w-9 p-0 flex items-center justify-center"
				>
					<ChevronRight className="h-4 w-4" />
				</Button>
			</ListboxMenu.ListboxMenuTrigger>
			<ListboxMenu.ListboxMenuContent>
				<ListboxMenu.ListboxRoot
					collection={columnCollection}
					onValueChange={(details) => {
						if (details.value && details.value.length > 0) {
							handleColumnSelect(details.value[0]);
							setFilterValue("");
							setIsOpen(false);
						}
					}}
				>
					<ListboxMenu.ListboxMenuFilterContainer>
						<ListboxMenu.ListboxMenuFilterInput
							placeholder="Filter columns..."
							value={filterValue}
							onChange={(e) => setFilterValue(e.currentTarget.value)}
						/>
					</ListboxMenu.ListboxMenuFilterContainer>
					<ListboxMenu.ListboxMenuList>
						{filteredColumns.length === 0 ? (
							<ListboxMenu.ListboxMenuEmpty>
								{filterValue ? "No columns match filter" : "No columns"}
							</ListboxMenu.ListboxMenuEmpty>
						) : (
							filteredColumns.map((colName) => (
								<ListboxMenu.ListboxMenuItem
									key={colName}
									item={{ label: colName, value: colName }}
									showIndicator={false}
								>
									{colName}
								</ListboxMenu.ListboxMenuItem>
							))
						)}
					</ListboxMenu.ListboxMenuList>
				</ListboxMenu.ListboxRoot>
			</ListboxMenu.ListboxMenuContent>
		</ListboxMenu.ListboxMenuRoot>
	);
}
