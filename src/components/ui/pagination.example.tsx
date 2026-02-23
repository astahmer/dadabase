import { useState } from "react";
import {
	Pagination,
	PaginationContent,
	PaginationContext,
	PaginationEllipsis,
	PaginationItem,
	PaginationNextTrigger,
	PaginationPrevTrigger,
} from "#src/components/ui/pagination.tsx";
import { Stack } from "./layout.tsx";

export function PaginationExample() {
	const [currentPage, setCurrentPage] = useState(1);
	const totalPages = 10;

	return (
		<Stack>
			<Pagination
				page={currentPage}
				onPageChange={(details) => setCurrentPage(details.page)}
				count={totalPages * 10}
				pageSize={10}
			>
				<PaginationContent>
					<PaginationPrevTrigger
						onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
					/>

					<PaginationContext>
						{(pagination) =>
							pagination.pages.map((page, index) =>
								page.type === "page" ? (
									<PaginationItem key={index} {...page}>
										{page.value}
									</PaginationItem>
								) : (
									<li key={index}>
										<PaginationEllipsis index={index} />
									</li>
								),
							)
						}
					</PaginationContext>

					<PaginationNextTrigger
						onClick={() =>
							setCurrentPage((prev) => Math.min(totalPages, prev + 1))
						}
					/>
				</PaginationContent>
			</Pagination>

			<div className="text-sm text-muted-foreground">
				Page {currentPage} of {totalPages}
			</div>
		</Stack>
	);
}
