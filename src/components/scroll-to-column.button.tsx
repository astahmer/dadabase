import { createListCollection } from "@ark-ui/react/listbox";
import { useFilter } from "@ark-ui/react/locale";
import { ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import * as ListboxMenu from "./ui/listbox-menu";

interface ScrollToColumnButtonProps {
	columnList: string[];
	containerRef: React.RefObject<HTMLDivElement | null>;
}

export function ScrollToColumnButton(props: ScrollToColumnButtonProps) {
	const { columnList, containerRef } = props;

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

	const columnCollection = createListCollection({
		items: columnList.map((colName) => ({
			label: colName,
			value: colName,
		})),
	});
	const filteredColumns = columnList.filter((colName) =>
		contains(colName, filterValue),
	);

	const handleColumnSelect = (columnName: string) => {
		// Just scroll to the column - the parent component handles visibility
		setTimeout(() => {
			if (containerRef.current) {
				const tableEl = containerRef.current.querySelector("table");
				if (tableEl) {
					const columnHeader = tableEl.querySelector(
						`th[data-column-id="${columnName}"]`,
					);
					if (columnHeader) {
						const scrollLeft =
							(columnHeader as HTMLElement).offsetLeft -
							containerRef.current!.clientWidth / 2;
						containerRef.current!.scrollLeft = Math.max(0, scrollLeft);
					}
				}
			}
		}, 0);
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
					className="absolute right-2 top-12 -translate-y-1/2 z-20 h-9 w-9 p-0 flex items-center justify-center"
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
