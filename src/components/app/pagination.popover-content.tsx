import { useState } from "react";
import { Button } from "../ui/button.tsx";
import { RowsPerPageSelector } from "../pages/connection-page/rows-per-page.selector.tsx";

interface PaginationPopoverContentProps {
	pageSize: number;
	initialPageIndex: number;
	totalRowCount: number;
	onPageSizeChange: (pageSize: number) => void;
	onConfirm: (pageIndex: number) => void;
	isLoading?: boolean;
}

/**
 * A popover that allows users to jump to a specific page
 * Shows limit, page input, and row range info
 */
export function PaginationPopoverContent(props: PaginationPopoverContentProps) {
	const {
		pageSize,
		initialPageIndex,
		totalRowCount,
		onPageSizeChange,
		onConfirm,
		isLoading = false,
	} = props;

	const totalPages = Math.ceil(totalRowCount / pageSize);
	const [pageNum, setPageNum] = useState(initialPageIndex + 1); // Convert to 1-indexed for display

	const handleJump = () => {
		if (Number.isNaN(pageNum) || pageNum < 1 || pageNum > totalPages) {
			return;
		}

		onConfirm(pageNum - 1); // Convert to 0-indexed
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") {
			handleJump();
		}
	};

	const startRow = (pageNum - 1) * pageSize + 1;
	const endRow = Math.min(pageNum * pageSize, totalRowCount);

	return (
		<div className="flex flex-col gap-3 min-w-max">
			<div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 items-center">
				{/* Limit Display */}
				<label className="text-xs font-medium text-muted-foreground">
					Limit
				</label>
				<RowsPerPageSelector
					value={pageSize}
					onValueChange={(newLimit) => {
						onPageSizeChange(newLimit);
					}}
				/>
				{/* Page Input */}
				<label
					htmlFor="page-input"
					className="text-xs font-medium text-muted-foreground"
				>
					Page
				</label>
				<input
					id="page-input"
					type="number"
					value={pageNum}
					onChange={(e) => setPageNum(e.target.valueAsNumber)}
					onKeyDown={handleKeyDown}
					autoFocus
					disabled={isLoading}
					min={1}
					max={Math.ceil(totalRowCount / pageSize)}
					className="mt-1 h-8 rounded-md border border-input bg-transparent px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 w-full"
				/>{" "}
				{/* Row Range Display */}
				<label className="text-xs font-medium text-muted-foreground">
					Rows
				</label>
				<div className="mt-1 px-2 py-1 text-sm">
					{startRow}–{endRow} rows
				</div>
			</div>

			{/* Action Button */}
			<Button
				onClick={handleJump}
				disabled={
					isLoading ||
					Number.isNaN(pageNum) ||
					pageNum < 1 ||
					pageNum > totalPages
				}
				size="sm"
				className="w-full"
			>
				Ok
			</Button>

			{/* Page Navigation Info */}
			<div className="flex items-center justify-between gap-2 pt-2 border-t">
				<Button
					variant="ghost"
					size="sm"
					onClick={() => {
						const newPage = Math.max(1, pageNum - 1);
						setPageNum(newPage);
					}}
					disabled={pageNum <= 1 || isLoading}
					className="h-7 text-xs"
				>
					‹
				</Button>
				<span className="text-xs text-muted-foreground text-center flex-1">
					{pageNum} / {totalPages === 0 ? "..." : totalPages}
				</span>
				<Button
					variant="ghost"
					size="sm"
					onClick={() => {
						const newPage = Math.min(totalPages, pageNum + 1);
						setPageNum(newPage);
					}}
					disabled={pageNum >= totalPages || isLoading}
					className="h-7 text-xs"
				>
					›
				</Button>
			</div>
		</div>
	);
}
