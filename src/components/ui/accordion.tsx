import { Accordion as AccordionPrimitive } from "@ark-ui/react/accordion";
import { ChevronDown } from "lucide-react";

import { cn } from "#src/lib/utils";

const Accordion = AccordionPrimitive.Root;

const AccordionContext = AccordionPrimitive.Context;

const AccordionItem = ({
	className,
	...props
}: AccordionPrimitive.ItemProps) => (
	<AccordionPrimitive.Item
		className={cn("border-b last:border-b-0", className)}
		{...props}
	/>
);
AccordionItem.displayName = "AccordionItem";

const AccordionItemContent = ({
	className,
	children,
	...props
}: AccordionPrimitive.ItemContentProps) => (
	<AccordionPrimitive.ItemContent
		className="overflow-hidden text-sm data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
		{...props}
	>
		<div className={cn("pt-0 pb-4", className)}>{children}</div>
	</AccordionPrimitive.ItemContent>
);
AccordionItemContent.displayName = "AccordionItemContent";

const AccordionItemContext = AccordionPrimitive.ItemContext;

const AccordionItemTrigger = ({
	className,
	children,
	...props
}: AccordionPrimitive.ItemTriggerProps) => (
	<AccordionPrimitive.ItemTrigger
		className={cn(
			"flex w-full flex-1 items-center justify-between gap-4 rounded-md py-4 text-left font-semibold text-sm outline-none transition-all hover:underline focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
			className,
		)}
		{...props}
	>
		{children}
		<AccordionPrimitive.ItemIndicator className="[&[data-state=open]>svg]:rotate-180">
			<ChevronDown className="pointer-events-none size-4 shrink-0 opacity-60 transition-transform duration-200" />
		</AccordionPrimitive.ItemIndicator>
	</AccordionPrimitive.ItemTrigger>
);
AccordionItemTrigger.displayName = "AccordionItemTrigger";

export {
	Accordion,
	AccordionContext,
	AccordionItem,
	AccordionItemContent,
	AccordionItemContext,
	AccordionItemTrigger,
};
