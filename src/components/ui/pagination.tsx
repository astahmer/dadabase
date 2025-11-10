"use client";

import {
	Pagination as PaginationPrimitive,
	paginationAnatomy,
} from "@ark-ui/react/pagination";
import type { VariantProps } from "class-variance-authority";
import { MoreHorizontal } from "lucide-react";
import * as React from "react";

import { buttonVariants } from "#src/components/ui/button";
import { cn } from "#src/lib/utils";
import type { ExposedComponentProps } from "./component-props.ts";

const parts = paginationAnatomy.extendWith("content").build();

const Pagination = ({
	className,
	...props
}: Omit<PaginationPrimitive.RootBaseProps, "type"> & ExposedComponentProps<"div">) => (
	<PaginationPrimitive.Root
		className={cn(
			"mx-auto flex w-full flex-row items-center justify-center gap-1",
			className,
		)}
		{...props}
	/>
);
Pagination.displayName = "Pagination";

const PaginationContent = ({ className, ...props }: React.HTMLAttributes<HTMLUListElement>) => (
	<ul
		{...parts.content.attrs}
		className={cn("flex flex-row items-center gap-1", className)}
		{...props}
	/>
);
PaginationContent.displayName = "PaginationContent";

const PaginationContext = PaginationPrimitive.Context;

const PaginationEllipsis = ({
	className,
	...props
}: PaginationPrimitive.EllipsisProps) => (
	<li>
		<PaginationPrimitive.Ellipsis
			aria-hidden
			className={cn("flex h-9 w-9 items-center justify-center", className)}
			{...props}
		>
			<MoreHorizontal className="h-4 w-4" />
			<span className="sr-only">More pages</span>
		</PaginationPrimitive.Ellipsis>
	</li>
);
PaginationEllipsis.displayName = "PaginationEllipsis";

export interface PaginationItemProps
	extends PaginationPrimitive.ItemProps,
		VariantProps<typeof buttonVariants> {}

const PaginationItem = ({
	className,
	variant = "outline",
	size,
	...props
}: PaginationItemProps) => (
	<li>
		<PaginationPrimitive.Item
			className={cn(buttonVariants({ variant, size }), className)}
			{...props}
		/>
	</li>
);
PaginationItem.displayName = "PaginationItem";

export interface PaginationNextTriggerProps
	extends PaginationPrimitive.NextTriggerProps,
		VariantProps<typeof buttonVariants> {}

const PaginationNextTrigger = ({
	className,
	variant = "outline",
	size,
	...props
}: PaginationNextTriggerProps) => (
	<li>
		<PaginationPrimitive.NextTrigger
			aria-label="Go to next page"
			className={cn(buttonVariants({ variant, size }), className)}
			{...props}
		/>
	</li>
);
PaginationNextTrigger.displayName = "PaginationNextTrigger";

export interface PaginationPrevTriggerProps
	extends PaginationPrimitive.PrevTriggerProps,
		VariantProps<typeof buttonVariants> {}

const PaginationPrevTrigger = ({
	className,
	variant = "outline",
	size,
	...props
}: PaginationPrevTriggerProps) => (
	<li>
		<PaginationPrimitive.PrevTrigger
			aria-label="Go to previous page"
			className={cn(buttonVariants({ variant, size }), className)}
			{...props}
		/>
	</li>
);
PaginationPrevTrigger.displayName = "PaginationPrevTrigger";

const PaginationRootProvider = PaginationPrimitive.RootProvider;

export {
	Pagination,
	PaginationContent,
	PaginationContext,
	PaginationEllipsis,
	PaginationItem,
	PaginationNextTrigger,
	PaginationPrevTrigger,
	PaginationRootProvider,
};

export { usePagination } from "@ark-ui/react/pagination";
