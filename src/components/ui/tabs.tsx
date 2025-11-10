"use client";

import { Tabs as TabsPrimitive } from "@ark-ui/react/tabs";

import { cn } from "#src/lib/utils";
import type { ExposedComponentProps } from "./component-props.ts";

const Tabs = ({
	className,
	...props
}: TabsPrimitive.RootBaseProps & ExposedComponentProps<"div">) => (
	<TabsPrimitive.Root
		className={cn("flex flex-col gap-2", className)}
		{...props}
	/>
);
Tabs.displayName = "Tabs";

const TabsContent = ({ className, ...props }: TabsPrimitive.ContentProps) => (
	<TabsPrimitive.Content
		className={cn("flex-1 outline-none", className)}
		{...props}
	/>
);
TabsContent.displayName = "TabsContent";

const TabsContext = TabsPrimitive.Context;

const TabsIndicator = ({
	className,
	...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Indicator>) => (
	<TabsPrimitive.Indicator
		className={cn(
			"h-(--height) w-(--width) rounded-sm bg-background text-foreground shadow-xs",
			className,
		)}
		{...props}
	/>
);
TabsIndicator.displayName = "TabsIndicator";

const TabsList = ({ className, ...props }: TabsPrimitive.ListProps) => (
	<TabsPrimitive.List
		className={cn(
			"relative inline-flex items-center justify-center rounded-md bg-muted p-0.5 text-muted-foreground/70 data-[orientation=vertical]:flex-col",
			className,
		)}
		{...props}
	/>
);
TabsList.displayName = "TabsList";

const TabsRootProvider = TabsPrimitive.RootProvider;

const TabsTrigger = ({ className, ...props }: TabsPrimitive.TriggerProps) => (
	<TabsPrimitive.Trigger
		className={cn(
			"inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 font-medium text-sm outline-none transition-all hover:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 data-[selected]:z-10 data-[orientation=vertical]:w-full data-[selected]:text-foreground [&_svg]:shrink-0",
			className,
		)}
		{...props}
	/>
);
TabsTrigger.displayName = "TabsTrigger";

export {
	Tabs,
	TabsContent,
	TabsContext,
	TabsIndicator,
	TabsList,
	TabsRootProvider,
	TabsTrigger,
};

export {
	useTabs,
	useTabsContext,
	type TabsFocusChangeDetails,
	type TabsValueChangeDetails,
} from "@ark-ui/react/tabs";
