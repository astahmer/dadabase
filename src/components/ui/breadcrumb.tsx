"use client";

import { ChevronRightIcon, EllipsisIcon } from "lucide-react";
import * as React from "react";
import { cn } from "#src/lib/utils";
import { breadcrumbVariants } from "./breadcrumb.styles";

////////////////////////////////////////////////////////////////////////////////////

export interface BreadcrumbRootProps
	extends React.HTMLAttributes<HTMLElement> {}

export const BreadcrumbRoot = ({
	className,
	...props
}: BreadcrumbRootProps) => (
	<nav
		className={cn(breadcrumbVariants.root(), className)}
		aria-label="breadcrumb"
		{...props}
	/>
);
BreadcrumbRoot.displayName = "BreadcrumbRoot";

////////////////////////////////////////////////////////////////////////////////////

export interface BreadcrumbListProps
	extends React.HTMLAttributes<HTMLOListElement> {
	size?: "sm" | "md" | "lg";
	variant?: "plain" | "underline";
}

export const BreadcrumbList = ({
	className,
	size = "md",
	variant = "plain",
	...props
}: BreadcrumbListProps) => (
	<ol
		className={cn(breadcrumbVariants.list({ size, variant }), className)}
		{...props}
	/>
);
BreadcrumbList.displayName = "BreadcrumbList";

////////////////////////////////////////////////////////////////////////////////////

export interface BreadcrumbItemProps
	extends React.HTMLAttributes<HTMLLIElement> {}

export const BreadcrumbItem = ({
	className,
	...props
}: BreadcrumbItemProps) => (
	<li className={cn(breadcrumbVariants.item(), className)} {...props} />
);
BreadcrumbItem.displayName = "BreadcrumbItem";

////////////////////////////////////////////////////////////////////////////////////

export interface BreadcrumbLinkProps
	extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
	variant?: "plain" | "underline";
}

export const BreadcrumbLink = ({
	className,
	variant = "plain",
	...props
}: BreadcrumbLinkProps) => (
	<a
		className={cn(breadcrumbVariants.link({ variant }), className)}
		{...props}
	/>
);
BreadcrumbLink.displayName = "BreadcrumbLink";

////////////////////////////////////////////////////////////////////////////////////

export interface BreadcrumbCurrentLinkProps
	extends React.HTMLAttributes<HTMLSpanElement> {
	variant?: "plain" | "underline";
}

export const BreadcrumbCurrentLink = ({
	className,
	variant = "plain",
	...props
}: BreadcrumbCurrentLinkProps) => (
	<span
		className={cn(breadcrumbVariants.currentLink({ variant }), className)}
		role="link"
		aria-current="page"
		{...props}
	/>
);
BreadcrumbCurrentLink.displayName = "BreadcrumbCurrentLink";

////////////////////////////////////////////////////////////////////////////////////

export interface BreadcrumbSeparatorProps
	extends React.HTMLAttributes<HTMLLIElement> {}

export const BreadcrumbSeparator = ({
	className,
	children,
	...props
}: BreadcrumbSeparatorProps) => (
	<li
		className={cn(breadcrumbVariants.separator(), className)}
		aria-hidden="true"
		{...props}
	>
		{children ?? <ChevronRightIcon />}
	</li>
);
BreadcrumbSeparator.displayName = "BreadcrumbSeparator";

////////////////////////////////////////////////////////////////////////////////////

export interface BreadcrumbEllipsisProps
	extends React.HTMLAttributes<HTMLLIElement> {}

export const BreadcrumbEllipsis = ({
	className,
	children,
	...props
}: BreadcrumbEllipsisProps) => (
	<li
		className={cn(breadcrumbVariants.ellipsis(), className)}
		role="presentation"
		aria-hidden="true"
		{...props}
	>
		{children ?? <EllipsisIcon />}
	</li>
);
BreadcrumbEllipsis.displayName = "BreadcrumbEllipsis";
