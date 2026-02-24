import { useState } from "react";

import { RowsPerPageSelector } from "../pages/connection-page/rows-per-page.selector.tsx";
import { Button } from "../ui/button.tsx";

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
    <div className="flex min-w-max flex-col gap-3">
      <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1">
        {/* Limit Display */}
        <label className="text-muted-foreground text-xs font-medium">Limit</label>
        <RowsPerPageSelector
          value={pageSize}
          onValueChange={(newLimit) => {
            onPageSizeChange(newLimit);
          }}
        />
        {/* Page Input */}
        <label htmlFor="page-input" className="text-muted-foreground text-xs font-medium">
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
          className="border-input focus-visible:ring-ring mt-1 h-8 w-full rounded-md border bg-transparent px-2 py-1 text-sm focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />{" "}
        {/* Row Range Display */}
        <label className="text-muted-foreground text-xs font-medium">Rows</label>
        <div className="mt-1 px-2 py-1 text-sm">
          {startRow}–{endRow} rows
        </div>
      </div>

      {/* Action Button */}
      <Button
        onClick={handleJump}
        disabled={isLoading || Number.isNaN(pageNum) || pageNum < 1 || pageNum > totalPages}
        size="sm"
        className="w-full"
      >
        Ok
      </Button>

      {/* Page Navigation Info */}
      <div className="flex items-center justify-between gap-2 border-t pt-2">
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
        <span className="text-muted-foreground flex-1 text-center text-xs">
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
