"use client";

import * as React from "react";
import { cn } from "#src/lib/utils";
import { breadcrumbVariants } from "./breadcrumb.styles";
import { ChevronRightIcon, EllipsisIcon } from "lucide-react";

////////////////////////////////////////////////////////////////////////////////////

export interface BreadcrumbRootProps
	extends React.HTMLAttributes<HTMLElement> {}

export const BreadcrumbRoot = React.forwardRef<
	HTMLElement,
	BreadcrumbRootProps
>(({ className, ...props }, ref) => (
	<nav
		ref={ref}
		className={cn(breadcrumbVariants.root(), className)}
		aria-label="breadcrumb"
		{...props}
	/>
));
BreadcrumbRoot.displayName = "BreadcrumbRoot";

////////////////////////////////////////////////////////////////////////////////////

export interface BreadcrumbListProps
	extends React.HTMLAttributes<HTMLOListElement> {
	size?: "sm" | "md" | "lg";
	variant?: "plain" | "underline";
}

export const BreadcrumbList = React.forwardRef<
	HTMLOListElement,
	BreadcrumbListProps
>(({ className, size = "md", variant = "plain", ...props }, ref) => (
	<ol
		ref={ref}
		className={cn(breadcrumbVariants.list({ size, variant }), className)}
		{...props}
	/>
));
BreadcrumbList.displayName = "BreadcrumbList";

////////////////////////////////////////////////////////////////////////////////////

export interface BreadcrumbItemProps
	extends React.HTMLAttributes<HTMLLIElement> {}

export const BreadcrumbItem = React.forwardRef<
	HTMLLIElement,
	BreadcrumbItemProps
>(({ className, ...props }, ref) => (
	<li
		ref={ref}
		className={cn(breadcrumbVariants.item(), className)}
		{...props}
	/>
));
BreadcrumbItem.displayName = "BreadcrumbItem";

////////////////////////////////////////////////////////////////////////////////////

export interface BreadcrumbLinkProps
	extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
	variant?: "plain" | "underline";
}

export const BreadcrumbLink = React.forwardRef<
	HTMLAnchorElement,
	BreadcrumbLinkProps
>(({ className, variant = "plain", ...props }, ref) => (
	<a
		ref={ref}
		className={cn(breadcrumbVariants.link({ variant }), className)}
		{...props}
	/>
));
BreadcrumbLink.displayName = "BreadcrumbLink";

////////////////////////////////////////////////////////////////////////////////////

export interface BreadcrumbCurrentLinkProps
	extends React.HTMLAttributes<HTMLSpanElement> {
	variant?: "plain" | "underline";
}

export const BreadcrumbCurrentLink = React.forwardRef<
	HTMLSpanElement,
	BreadcrumbCurrentLinkProps
>(({ className, variant = "plain", ...props }, ref) => (
	<span
		ref={ref}
		className={cn(breadcrumbVariants.currentLink({ variant }), className)}
		role="link"
		aria-current="page"
		{...props}
	/>
));
BreadcrumbCurrentLink.displayName = "BreadcrumbCurrentLink";

////////////////////////////////////////////////////////////////////////////////////

export interface BreadcrumbSeparatorProps
	extends React.HTMLAttributes<HTMLLIElement> {}

export const BreadcrumbSeparator = React.forwardRef<
	HTMLLIElement,
	BreadcrumbSeparatorProps
>(({ className, children, ...props }, ref) => (
	<li
		ref={ref}
		className={cn(breadcrumbVariants.separator(), className)}
		aria-hidden="true"
		{...props}
	>
		{children ?? <ChevronRightIcon />}
	</li>
));
BreadcrumbSeparator.displayName = "BreadcrumbSeparator";

////////////////////////////////////////////////////////////////////////////////////

export interface BreadcrumbEllipsisProps
	extends React.HTMLAttributes<HTMLLIElement> {}

export const BreadcrumbEllipsis = React.forwardRef<
	HTMLLIElement,
	BreadcrumbEllipsisProps
>(({ className, children, ...props }, ref) => (
	<li
		ref={ref}
		className={cn(breadcrumbVariants.ellipsis(), className)}
		role="presentation"
		aria-hidden="true"
		{...props}
	>
		{children ?? <EllipsisIcon />}
	</li>
));
BreadcrumbEllipsis.displayName = "BreadcrumbEllipsis";
